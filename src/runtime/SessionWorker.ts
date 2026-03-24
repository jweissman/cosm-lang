import { MessagePort, parentPort } from "node:worker_threads";
import Cosm from "../cosm";
import { ValueAdapter } from "../ValueAdapter";
import { CosmErrorValue } from "../values/CosmErrorValue";

type SessionWireHistoryEntry = {
  source: string;
  ok: boolean;
  inspect: string;
  error?: unknown;
};

type SessionWireResponse = {
  id: number;
  ok: boolean;
  value: unknown;
  inspect: string;
  error: unknown;
  history: SessionWireHistoryEntry[];
};

let port: MessagePort | undefined;
let env = Cosm.Interpreter.createEnv(undefined, { allowTopLevelRebinds: true });
let historyEntries: SessionWireHistoryEntry[] = [];

parentPort?.on("message", (message: unknown) => {
  if (!message || typeof message !== "object") {
    return;
  }
  const record = message as { type?: string; port?: MessagePort };
  if (record.type === "init" && record.port) {
    port = record.port;
    port.on("message", handleRequest);
    port.start();
  }
});

function handleRequest(message: unknown): void {
  if (!port || !message || typeof message !== "object") {
    return;
  }
  const record = message as {
    id: number;
    command: "eval" | "tryEval" | "reset";
    source?: string;
    signal: SharedArrayBuffer;
  };
  const signalView = new Int32Array(record.signal);
  let response: SessionWireResponse;

  try {
    switch (record.command) {
      case "reset":
        env = Cosm.Interpreter.createEnv(undefined, { allowTopLevelRebinds: true });
        historyEntries = [];
        response = {
          id: record.id,
          ok: true,
          value: false,
          inspect: "true",
          error: false,
          history: [],
        };
        break;
      case "eval":
      case "tryEval":
        response = evaluate(record.id, record.source ?? "");
        break;
    }
  } catch (error) {
    const wrapped = CosmErrorValue.fromUnknown(error);
    response = {
      id: record.id,
      ok: false,
      value: false,
      inspect: wrapped.toDisplayString(),
      error: ValueAdapter.cosmToJS(wrapped),
      history: historyEntries,
    };
  }

  port.postMessage(response);
  Atomics.store(signalView, 0, 1);
  Atomics.notify(signalView, 0);
}

function evaluate(id: number, source: string): SessionWireResponse {
  try {
    const value = Cosm.Interpreter.evalInEnv(source, env);
    const inspect = ValueAdapter.format(value);
    historyEntries.push({ source, ok: true, inspect });
    return {
      id,
      ok: true,
      value: ValueAdapter.cosmToJS(value),
      inspect,
      error: false,
      history: historyEntries,
    };
  } catch (error) {
    const wrapped = CosmErrorValue.fromUnknown(error);
    historyEntries.push({
      source,
      ok: false,
      inspect: wrapped.toDisplayString(),
      error: ValueAdapter.cosmToJS(wrapped),
    });
    return {
      id,
      ok: false,
      value: false,
      inspect: wrapped.toDisplayString(),
      error: ValueAdapter.cosmToJS(wrapped),
      history: historyEntries,
    };
  }
}

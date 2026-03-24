import { MessageChannel, MessagePort, Worker, isMainThread, receiveMessageOnPort } from "node:worker_threads";
import { Construct } from "../Construct";
import { ValueAdapter } from "../ValueAdapter";
import { CosmEnv, CosmValue } from "../types";
import { CosmClassValue } from "../values/CosmClassValue";
import { CosmErrorValue } from "../values/CosmErrorValue";
import { CosmRaisedError } from "./CosmRaisedError";

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

export type SessionRuntimeResult = {
  ok: boolean;
  value: CosmValue;
  inspect: string;
  error: CosmErrorValue | false;
  history: SessionWireHistoryEntry[];
};

export type SessionRuntimeHandle = {
  eval(source: string): SessionRuntimeResult;
  tryEval(source: string): SessionRuntimeResult;
  reset(): void;
  history(): SessionWireHistoryEntry[];
};

type RuntimeHandleOptions = {
  name: string;
  errorClassRef?: CosmClassValue;
  evalInEnv: (source: string, env: CosmEnv) => CosmValue;
  createEnv: () => CosmEnv;
  inline?: boolean;
};

export class SessionRuntime {
  static createHandle(options: RuntimeHandleOptions): SessionRuntimeHandle {
    if (options.inline || !isMainThread) {
      return new InlineSessionRuntimeHandle(options);
    }
    return new WorkerSessionRuntimeHandle(options);
  }
}

class InlineSessionRuntimeHandle implements SessionRuntimeHandle {
  private env: CosmEnv;
  private historyEntries: SessionWireHistoryEntry[] = [];

  constructor(private readonly options: RuntimeHandleOptions) {
    this.env = options.createEnv();
  }

  eval(source: string): SessionRuntimeResult {
    try {
      const value = this.options.evalInEnv(source, this.env);
      return this.recordSuccess(source, value);
    } catch (error) {
      return this.recordFailure(source, error);
    }
  }

  tryEval(source: string): SessionRuntimeResult {
    return this.eval(source);
  }

  reset(): void {
    this.env = this.options.createEnv();
    this.historyEntries = [];
  }

  history(): SessionWireHistoryEntry[] {
    return [...this.historyEntries];
  }

  private recordSuccess(source: string, value: CosmValue): SessionRuntimeResult {
    const inspect = ValueAdapter.format(value);
    const entry = { source, ok: true, inspect };
    this.historyEntries.push(entry);
    return {
      ok: true,
      value,
      inspect,
      error: false,
      history: this.history(),
    };
  }

  private recordFailure(source: string, error: unknown): SessionRuntimeResult {
    const wrapped = CosmErrorValue.fromUnknown(error, this.options.errorClassRef);
    const entry = {
      source,
      ok: false,
      inspect: wrapped.toDisplayString(),
      error: ValueAdapter.cosmToJS(wrapped),
    };
    this.historyEntries.push(entry);
    return {
      ok: false,
      value: Construct.bool(false),
      inspect: wrapped.toDisplayString(),
      error: wrapped,
      history: this.history(),
    };
  }
}

class WorkerSessionRuntimeHandle implements SessionRuntimeHandle {
  private worker?: Worker;
  private port?: MessagePort;
  private nextId = 1;
  private historyEntries: SessionWireHistoryEntry[] = [];

  constructor(private readonly options: RuntimeHandleOptions) {}

  eval(source: string): SessionRuntimeResult {
    return this.request("eval", source);
  }

  tryEval(source: string): SessionRuntimeResult {
    return this.request("tryEval", source);
  }

  reset(): void {
    const { history } = this.request("reset");
    this.historyEntries = history;
  }

  history(): SessionWireHistoryEntry[] {
    return [...this.historyEntries];
  }

  private request(command: "eval" | "tryEval" | "reset", source = ""): SessionRuntimeResult {
    this.ensureWorker();

    const signal = new SharedArrayBuffer(4);
    const signalView = new Int32Array(signal);
    const id = this.nextId++;
    const timeoutMs = this.timeoutMs();

    this.port!.postMessage({ id, command, source, signal });

    const waitStatus = Atomics.wait(signalView, 0, 0, timeoutMs);
    if (waitStatus === "timed-out") {
      this.recycleWorker();
      return this.timeoutResult(timeoutMs);
    }

    const received = receiveMessageOnPort(this.port!);
    if (!received || typeof received.message !== "object" || received.message === null) {
      this.recycleWorker();
      return this.runtimeFailure("Session worker returned no response");
    }

    const message = received.message as SessionWireResponse;
    if (message.id !== id) {
      this.recycleWorker();
      return this.runtimeFailure("Session worker returned a mismatched response");
    }

    this.historyEntries = message.history;
    const error = this.deserializeError(message.error);
    return {
      ok: message.ok,
      value: this.deserializeValue(message.value),
      inspect: message.inspect,
      error,
      history: this.history(),
    };
  }

  private ensureWorker(): void {
    if (this.worker && this.port) {
      return;
    }

    const worker = new Worker(new URL("./SessionWorker.ts", import.meta.url));
    const channel = new MessageChannel();
    worker.postMessage({ type: "init", name: this.options.name, port: channel.port2 }, [channel.port2]);
    worker.unref();
    channel.port1.unref();
    channel.port2.unref();
    this.worker = worker;
    this.port = channel.port1;
  }

  private recycleWorker(): void {
    this.port?.close();
    this.port = undefined;
    if (this.worker) {
      this.worker.unref();
      this.worker = undefined;
    }
  }

  private timeoutResult(timeoutMs: number): SessionRuntimeResult {
    return this.runtimeFailure(`Session timeout: evaluation exceeded ${timeoutMs}ms`);
  }

  private runtimeFailure(message: string): SessionRuntimeResult {
    const error = new CosmErrorValue(message, [], Construct.bool(false), this.options.errorClassRef);
    return {
      ok: false,
      value: Construct.bool(false),
      inspect: error.toDisplayString(),
      error,
      history: this.history(),
    };
  }

  private deserializeValue(value: unknown): CosmValue {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if (record.kind === "error") {
        return this.deserializeError(record) || Construct.bool(false);
      }
      if (record.kind === "symbol" && typeof record.name === "string") {
        return Construct.symbol(record.name);
      }
    }
    return ValueAdapter.jsToCosm(value as Parameters<typeof ValueAdapter.jsToCosm>[0]);
  }

  private deserializeError(value: unknown): CosmErrorValue | false {
    if (!value || value === false || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const record = value as Record<string, unknown>;
    if (record.kind !== "error") {
      return false;
    }
    return new CosmErrorValue(
      typeof record.message === "string" ? record.message : "Session worker error",
      Array.isArray(record.backtrace) ? record.backtrace.map((entry) => String(entry)) : [],
      record.details === false ? Construct.bool(false) : this.deserializeValue(record.details),
      this.options.errorClassRef,
    );
  }

  private timeoutMs(): number {
    return Number(process.env.COSM_SESSION_TIMEOUT_MS ?? "1500");
  }
}

export function raiseSessionResult(result: SessionRuntimeResult): CosmValue {
  if (result.ok) {
    return result.value;
  }
  if (result.error) {
    throw new CosmRaisedError(result.error);
  }
  throw new CosmRaisedError(new CosmErrorValue("Session evaluation failed"));
}

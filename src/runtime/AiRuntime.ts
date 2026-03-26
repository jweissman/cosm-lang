import { execFileSync } from "node:child_process";
import { MessageChannel, receiveMessageOnPort, Worker } from "node:worker_threads";
import { Construct } from "../Construct";
import { CosmClassValue } from "../values/CosmClassValue";
import { CosmSchemaValue } from "../values/CosmSchemaValue";
import { CosmStringValue } from "../values/CosmStringValue";
import { ValueAdapter } from "../ValueAdapter";

type LmStudioConfig = {
  backend: string;
  baseUrl: string;
  model?: string;
  configured: boolean;
};

type ChatMessage = {
  role: string;
  content: string;
};

type ChatOptions = {
  responseFormat?: Record<string, unknown>;
};

export type AiStreamEvent = {
  kind: "waiting" | "chunk" | "done";
  text?: string;
  first?: boolean;
  index?: number;
};

type StreamWorkerMessage =
  | { kind: "chunk"; text: string }
  | { kind: "done"; text: string }
  | { kind: "error"; error: string };

export function normalizeSemanticPair(left: string, right: string): [string, string] {
  const leftKey = left.trim().toLowerCase();
  const rightKey = right.trim().toLowerCase();
  if (leftKey < rightKey) {
    return [left, right];
  }
  if (leftKey > rightKey) {
    return [right, left];
  }
  return left <= right ? [left, right] : [right, left];
}

export function extractOpenAiStreamText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  if (record.error && typeof record.error === "object") {
    const error = record.error as Record<string, unknown>;
    if (typeof error.message === "string") {
      throw new Error(`AI backend error: ${error.message}`);
    }
  }
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const choice = choices[0];
  if (!choice || typeof choice !== "object") {
    return "";
  }
  const choiceRecord = choice as Record<string, unknown>;
  return contentFromStreamPayload(choiceRecord.delta) || contentFromStreamPayload(choiceRecord.message);
}

export function parseOpenAiStreamBlock(block: string): string[] {
  const texts: string[] = [];
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"));
  for (const line of lines) {
    const dataLine = line.slice("data:".length).trim();
    if (dataLine === "[DONE]") {
      continue;
    }
    const parsed = JSON.parse(dataLine) as unknown;
    const text = extractOpenAiStreamText(parsed);
    if (text.length > 0) {
      texts.push(text);
    }
  }
  return texts;
}

export function parseStructuredCompletionText(content: string, schema: CosmSchemaValue) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`AI cast returned invalid JSON: ${message}`);
  }
  try {
    return schema.validateAndReturn(ValueAdapter.jsToCosm(parsed as Record<string, unknown>));
  } catch (error) {
    const message = error instanceof Error ? error.message : "schema validation failed";
    throw new Error(`AI cast schema mismatch: ${message}`);
  }
}

export function parseSemanticCompareText(content: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`AI semantic comparison returned invalid JSON: ${message}`);
  }
  const equal = (parsed as { equal?: unknown }).equal;
  if (typeof equal !== "boolean") {
    throw new Error("AI semantic comparison returned an invalid payload");
  }
  return equal;
}

function contentFromStreamPayload(delta: unknown): string {
  if (typeof delta === "string") {
    return delta;
  }
  if (Array.isArray(delta)) {
    return delta
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }
        if (entry && typeof entry === "object") {
          const record = entry as Record<string, unknown>;
          if (typeof record.text === "string") {
            return record.text;
          }
        }
        return "";
      })
      .join("");
  }
  if (delta && typeof delta === "object") {
    const record = delta as Record<string, unknown>;
    if (typeof record.content === "string") {
      return record.content;
    }
    if (typeof record.text === "string") {
      return record.text;
    }
  }
  return "";
}

export class AiRuntime {
  private static readonly discoveryCache = new Map<string, { value: string | false; expiresAt: number }>();

  static status(namespaceClassRef?: CosmClassValue) {
    return this.configNamespace(namespaceClassRef);
  }

  static configNamespace(namespaceClassRef?: CosmClassValue) {
    const config = this.config();
    return Construct.namespace({
      backend: Construct.string(config.backend),
      baseUrl: Construct.string(config.baseUrl),
      model: config.model ? Construct.string(config.model) : Construct.bool(false),
      configured: Construct.bool(config.configured),
    }, namespaceClassRef);
  }

  static health(namespaceClassRef?: CosmClassValue) {
    const config = this.config();
    const result = this.probe(config.baseUrl);
    return Construct.namespace({
      backend: Construct.string(config.backend),
      baseUrl: Construct.string(config.baseUrl),
      model: config.model ? Construct.string(config.model) : Construct.bool(false),
      configured: Construct.bool(config.configured),
      ok: Construct.bool(result.ok),
      error: result.error ? Construct.string(result.error) : Construct.bool(false),
    }, namespaceClassRef);
  }

  static complete(prompt: string) {
    const content = this.chat([
      { role: "user", content: prompt },
    ]);
    return new CosmStringValue(content);
  }

  static cast(prompt: string, schema: CosmSchemaValue) {
    const schemaValue = schema.nativeMethod("jsonSchema")?.nativeCall?.([], schema);
    const schemaObject = schemaValue ? ValueAdapter.cosmToJS(schemaValue) : {};
    const content = this.chat([
      {
        role: "system",
        content: `Return only valid JSON matching this schema: ${JSON.stringify(schemaObject)}`,
      },
      { role: "user", content: prompt },
    ], {
      responseFormat: this.jsonSchemaResponseFormat("cosm_cast", schemaObject as Record<string, unknown>),
    });
    return parseStructuredCompletionText(content, schema);
  }

  static stream(prompt: string, onEvent: (event: AiStreamEvent) => void) {
    const config = this.config(true);
    const payload: Record<string, unknown> = {
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    };
    return this.runStreamingWorker(config.baseUrl, payload, onEvent);
  }

  static compare(left: string, right: string): boolean {
    const normalizedLeft = left.trim().toLowerCase();
    const normalizedRight = right.trim().toLowerCase();
    if (normalizedLeft === normalizedRight) {
      return true;
    }
    const [first, second] = normalizeSemanticPair(left, right);
    const content = this.chat([
      {
        role: "system",
        content: [
          "Decide whether the two inputs are semantically equivalent in ordinary usage.",
          "This relation must be symmetric: swapping the inputs must not change the answer.",
          "Return true only for the same concept or a near-direct synonym.",
          "Return false for parent/child relations, examples, subtypes, associations, or merely related terms.",
          'Examples: "cat" vs "feline" => true; "dog" vs "canine" => true; "cat" vs "kitten" => false; "cat" vs "dog" => false.',
          "Return only structured JSON.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Are these semantically equivalent?\nA: ${first}\nB: ${second}`,
      },
    ], {
      responseFormat: this.jsonSchemaResponseFormat("semantic_compare", {
        type: "object",
        additionalProperties: false,
        properties: {
          equal: { type: "boolean" },
        },
        required: ["equal"],
      }),
    });
    return parseSemanticCompareText(content);
  }

  private static chat(messages: ChatMessage[], options?: ChatOptions): string {
    const config = this.config(true);
    const payload: Record<string, unknown> = {
      model: config.model,
      messages,
      temperature: 0,
    };
    if (options?.responseFormat) {
      payload.response_format = options.responseFormat;
    }
    const raw = execFileSync("curl", [
      "-sS",
      "-X",
      "POST",
      `${config.baseUrl}/chat/completions`,
      "-H",
      "Content-Type: application/json",
      "-d",
      JSON.stringify(payload),
    ], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: unknown; refusal?: string; parsed?: unknown } }>;
    };
    if (parsed.error?.message) {
      throw new Error(`AI backend error: ${parsed.error.message}`);
    }
    const message = parsed.choices?.[0]?.message;
    if (!message) {
      throw new Error(`AI backend returned no choices: ${this.truncate(raw)}`);
    }
    if (typeof message.parsed === "object" && message.parsed !== null) {
      return JSON.stringify(message.parsed);
    }
    if (typeof message.content === "string" && message.content.length > 0) {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      const text = message.content
        .map((chunk) => {
          if (typeof chunk === "string") {
            return chunk;
          }
          if (chunk && typeof chunk === "object") {
            const record = chunk as Record<string, unknown>;
            if (typeof record.text === "string") {
              return record.text;
            }
          }
          return "";
        })
        .join("")
        .trim();
      if (text.length > 0) {
        return text;
      }
    }
    if (message.refusal) {
      throw new Error(`AI backend refused the request: ${message.refusal}`);
    }
    throw new Error(`AI backend returned no completion content: ${this.truncate(raw)}`);
  }

  private static config(requireModel = false): LmStudioConfig {
    const backend = process.env.COSM_AI_BACKEND ?? "lmstudio";
    const baseUrl = process.env.COSM_AI_BASE_URL ?? "http://127.0.0.1:1234/v1";
    const model = process.env.COSM_AI_MODEL ?? (this.shouldDiscoverModel() ? this.discoverModel(baseUrl) : undefined);
    if (backend !== "lmstudio") {
      throw new Error(`AI backend '${backend}' is not supported in 0.3.12.5`);
    }
    if (requireModel && !model) {
      throw new Error("AI backend is not configured: set COSM_AI_MODEL or expose a model via LM Studio /v1/models");
    }
    return {
      backend,
      baseUrl,
      model,
      configured: Boolean(model),
    };
  }

  private static discoverModel(baseUrl: string): string | undefined {
    const cached = this.discoveryCache.get(baseUrl);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value || undefined;
    }

    try {
      const raw = execFileSync("curl", [
        "-s",
        "--connect-timeout",
        "0.2",
        "--max-time",
        "0.5",
        `${baseUrl}/models`,
      ], {
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
      });
      const parsed = JSON.parse(raw) as { data?: Array<{ id?: string }> };
      const model = parsed.data?.find((entry) => typeof entry.id === "string" && entry.id.length > 0)?.id;
      this.discoveryCache.set(baseUrl, {
        value: model || false,
        expiresAt: Date.now() + 1_000,
      });
      return model;
    } catch {
      this.discoveryCache.set(baseUrl, {
        value: false,
        expiresAt: Date.now() + 1_000,
      });
      return undefined;
    }
  }

  private static probe(baseUrl: string): { ok: boolean; error?: string } {
    try {
      const raw = execFileSync("curl", [
        "-s",
        "--connect-timeout",
        "0.2",
        "--max-time",
        "0.5",
        `${baseUrl}/models`,
      ], {
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
      });
      const parsed = JSON.parse(raw) as { data?: unknown };
      if (!Array.isArray(parsed.data)) {
        return { ok: false, error: "AI backend probe returned an invalid models payload" };
      }
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "AI backend probe failed",
      };
    }
  }

  private static shouldDiscoverModel(): boolean {
    return process.env.COSM_AI_AUTO_DISCOVER_MODEL !== "0";
  }

  private static jsonSchemaResponseFormat(name: string, schema: Record<string, unknown>) {
    return {
      type: "json_schema",
      json_schema: {
        name,
        strict: true,
        schema,
      },
    };
  }

  private static truncate(value: string, limit = 400): string {
    return value.length > limit ? `${value.slice(0, limit)}...` : value;
  }

  private static runStreamingWorker(
    baseUrl: string,
    payload: Record<string, unknown>,
    onEvent: (event: AiStreamEvent) => void,
  ): CosmStringValue {
    const channel = new MessageChannel();
    const worker = new Worker(new URL("./AiStreamWorker.ts", import.meta.url), {
      workerData: {
        baseUrl,
        payload,
        port: channel.port2,
      },
      transferList: [channel.port2],
    });

    let waitingIndex = 0;
    let chunkIndex = 0;
    let sawChunk = false;
    let finalText = "";
    let done = false;
    let workerError: string | undefined;

    onEvent({
      kind: "waiting",
      first: false,
      index: waitingIndex,
      text: this.spinnerFrame(waitingIndex),
    });

    while (!done && !workerError) {
      const packet = receiveMessageOnPort(channel.port1) as { message: StreamWorkerMessage } | undefined;
      if (!packet) {
        if (!sawChunk) {
          waitingIndex += 1;
          onEvent({
            kind: "waiting",
            first: false,
            index: waitingIndex,
            text: this.spinnerFrame(waitingIndex),
          });
        }
        this.sleep(80);
        continue;
      }

      const message = packet.message;
      if (message.kind === "chunk") {
        sawChunk = true;
        finalText += message.text;
        onEvent({
          kind: "chunk",
          text: message.text,
          first: chunkIndex === 0,
          index: chunkIndex,
        });
        chunkIndex += 1;
        continue;
      }

      if (message.kind === "done") {
        done = true;
        finalText = message.text;
        onEvent({
          kind: "done",
          text: finalText,
          first: false,
          index: chunkIndex,
        });
        break;
      }

      workerError = message.error;
    }

    channel.port1.close();
    worker.terminate();

    if (workerError) {
      throw new Error(workerError);
    }

    return new CosmStringValue(finalText);
  }

  private static spinnerFrame(index: number): string {
    const frames = ["|", "/", "-", "\\"];
    return `iapetus> [thinking ${frames[index % frames.length]}]`;
  }

  private static sleep(ms: number): void {
    const shared = new SharedArrayBuffer(4);
    const array = new Int32Array(shared);
    Atomics.wait(array, 0, 0, ms);
  }
}

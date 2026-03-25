import { execFileSync } from "node:child_process";
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
    const parsed = JSON.parse(content);
    return schema.validateAndReturn(ValueAdapter.jsToCosm(parsed));
  }

  static stream(prompt: string, onEvent: (event: AiStreamEvent) => void) {
    onEvent({ kind: "waiting", first: false, index: 0 });
    const content = this.chat([
      { role: "user", content: prompt },
    ]);
    const chunks = this.chunkText(content);
    chunks.forEach((chunk, index) => {
      onEvent({
        kind: "chunk",
        text: chunk,
        first: index === 0,
        index,
      });
    });
    onEvent({
      kind: "done",
      text: content,
      first: false,
      index: chunks.length,
    });
    return new CosmStringValue(content);
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
    const parsed = JSON.parse(content) as { equal?: boolean };
    if (typeof parsed.equal !== "boolean") {
      throw new Error("AI backend returned an invalid semantic comparison payload");
    }
    return parsed.equal;
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
      throw new Error(`AI backend '${backend}' is not supported in 0.3.11`);
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

  private static chunkText(value: string): string[] {
    const chunks = value.match(/[^\s]+\s*|\s+/g) ?? [];
    if (chunks.length > 0) {
      return chunks;
    }
    return value.length > 0 ? [value] : [];
  }
}

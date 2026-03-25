import { expect, test } from "bun:test";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";
import { Construct } from "../src/Construct";
import { CosmAiValue } from "../src/values/CosmAiValue";
import { AiRuntime, normalizeSemanticPair } from "../src/runtime/AiRuntime";
import { CosmSchemaValue } from "../src/values/CosmSchemaValue";

const cosmEval = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(input));

test("cosm.ai.status reports LM Studio defaults clearly", () => {
  const previousBackend = process.env.COSM_AI_BACKEND;
  const previousBaseUrl = process.env.COSM_AI_BASE_URL;
  const previousModel = process.env.COSM_AI_MODEL;

  delete process.env.COSM_AI_BACKEND;
  process.env.COSM_AI_BASE_URL = "http://127.0.0.1:1/v1";
  delete process.env.COSM_AI_MODEL;

  try {
    const status = cosmEval("cosm.ai.status()") as {
      backend: string;
      baseUrl: string;
      model: boolean;
      configured: boolean;
    };
    const config = cosmEval('require("cosm/ai.cosm"); ai.config()') as {
      backend: string;
      baseUrl: string;
      model: boolean;
      configured: boolean;
    };
    expect(status.backend).toBe("lmstudio");
    expect(status.baseUrl).toBe("http://127.0.0.1:1/v1");
    expect(status.model).toBe(false);
    expect(status.configured).toBe(false);
    expect(config).toEqual(status);
    const health = cosmEval("cosm.ai.health()") as {
      ok: boolean;
      error: string | boolean;
    };
    expect(health.ok).toBe(false);
    expect(typeof health.error).toBe("string");
  } finally {
    if (previousBackend === undefined) {
      delete process.env.COSM_AI_BACKEND;
    } else {
      process.env.COSM_AI_BACKEND = previousBackend;
    }
    if (previousBaseUrl === undefined) {
      delete process.env.COSM_AI_BASE_URL;
    } else {
      process.env.COSM_AI_BASE_URL = previousBaseUrl;
    }
    if (previousModel === undefined) {
      delete process.env.COSM_AI_MODEL;
    } else {
      process.env.COSM_AI_MODEL = previousModel;
    }
  }
});

test("Schema.jsonSchema exports stable reflective shapes", () => {
  expect(cosmEval('Schema.string().jsonSchema()')).toMatchObject({ type: "string" });
  expect(cosmEval('Schema.optional(Schema.number()).jsonSchema()')).toMatchObject({
    anyOf: [{ type: "number" }, { type: "null" }],
  });
  expect(cosmEval('Schema.enum("a", "b").jsonSchema()')).toMatchObject({ enum: ["a", "b"] });
  expect(cosmEval('Schema.object({ answer: Schema.string(), count: Schema.optional(Schema.number()) }).jsonSchema()')).toMatchObject({
    type: "object",
    additionalProperties: false,
    required: ["answer"],
    properties: {
      answer: { type: "string" },
      count: { anyOf: [{ type: "number" }, { type: "null" }] },
    },
  });
});

test("cosm.ai complete, cast, and compare can be driven through a mocked adapter", () => {
  CosmAiValue.installRuntimeHooks({
    status: () => Construct.namespace({
      backend: Construct.string("mock"),
      baseUrl: Construct.string("http://mock"),
      model: Construct.string("mock-model"),
      configured: Construct.bool(true),
    }),
    health: () => Construct.namespace({
      backend: Construct.string("mock"),
      baseUrl: Construct.string("http://mock"),
      model: Construct.string("mock-model"),
      configured: Construct.bool(true),
      ok: Construct.bool(true),
      error: Construct.bool(false),
    }),
    complete: (prompt) => Construct.string(`complete:${prompt}`),
    cast: (prompt, schema) => (schema as CosmSchemaValue).validateAndReturn(Construct.string(`cast:${prompt}`)),
    compare: (left, right) => left.trim().toLowerCase() === right.trim().toLowerCase(),
    stream: (prompt, onEvent) => {
      onEvent({ kind: "waiting", index: 0, buffered: true });
      onEvent({ kind: "chunk", text: `stream:${prompt}`, first: true, index: 0, buffered: true });
      onEvent({ kind: "done", text: `stream:${prompt}`, index: 1, buffered: true });
      return Construct.string(`stream:${prompt}`);
    },
  });

  try {
    expect(cosmEval('cosm.ai.config().model')).toBe("mock-model");
    expect(cosmEval('cosm.ai.health().ok')).toBe(true);
    expect(cosmEval('cosm.ai.complete("hello")')).toBe("complete:hello");
    expect(cosmEval('cosm.ai.cast("hello", Schema.string())')).toBe("cast:hello");
    expect(cosmEval('"Hello" ~= " hello "')).toBe(true);
    let stdout = "";
    const originalWrite = process.stdout.write;
    (process.stdout as unknown as { write: typeof process.stdout.write }).write = ((chunk: string | Uint8Array) => {
      stdout += String(chunk);
      return true;
    }) as typeof process.stdout.write;
    try {
      expect(cosmEval(`
        let final = cosm.ai.stream("hello") do |event|
          if event.kind == "waiting" then
            Kernel.print("[waiting]")
          else
            if event.kind == "chunk" then
              Kernel.print(event.text)
            else
              true
            end
          end
        end
        final
      `)).toBe("stream:hello");
    } finally {
      (process.stdout as unknown as { write: typeof process.stdout.write }).write = originalWrite;
    }
    expect(stdout).toContain("[waiting]");
    expect(stdout).toContain("stream:hello");
  } finally {
    CosmAiValue.installRuntimeHooks({
      status: () => AiRuntime.status(),
      health: () => AiRuntime.health(),
      complete: (prompt) => AiRuntime.complete(prompt),
      cast: (prompt, schema) => AiRuntime.cast(prompt, schema as CosmSchemaValue),
      compare: (left, right) => AiRuntime.compare(left, right),
      stream: (prompt, onEvent) => AiRuntime.stream(prompt, onEvent),
    });
  }
});

test("semantic comparison input normalization is symmetric", () => {
  expect(normalizeSemanticPair("dog", "canine")).toEqual(["canine", "dog"]);
  expect(normalizeSemanticPair("canine", "dog")).toEqual(["canine", "dog"]);
  expect(normalizeSemanticPair("Cat", "cat")).toEqual(["Cat", "cat"]);
});

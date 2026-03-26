import { expect, test } from "bun:test";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";
import { CosmAiValue } from "../src/values/CosmAiValue";
import { Construct } from "../src/Construct";
import { AiRuntime } from "../src/runtime/AiRuntime";
import { CosmSchemaValue } from "../src/values/CosmSchemaValue";

process.env.COSM_AI_AUTO_DISCOVER_MODEL ??= "0";

const cosmEval = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(input));

test("Data exposes a module-backed ergonomic model layer over Schema", () => {
  expect(cosmEval("Cosm::Data.class.name")).toBe("Module");
  expect(cosmEval("Cosm::Data::Model.name")).toBe("DataModel");
  expect(cosmEval("Cosm::Data.class.name")).toBe("Module");
  expect(cosmEval("Cosm::Data.string().describe()")).toBe("Schema.string()");
  expect(cosmEval('Cosm::Data.model("Reason", { answer: Cosm::Data.string(), choice: Cosm::Data.enum("yes", "no") }).class.name')).toBe("DataModel");
});

test("Data models support nested casts and reflective schema export", () => {
  expect(cosmEval('let Reason = Cosm::Data.model("Reason", { answer: Cosm::Data.string(), choice: Cosm::Data.enum("yes", "no"), nested: Cosm::Data.optional(Cosm::Data.array(Cosm::Data.number())) }); Reason.validate({ answer: "hi", choice: "yes", nested: [1, 2] })')).toBe(true);

  expect(cosmEval('let Reason = Cosm::Data.model("Reason", { answer: Cosm::Data.string(), choice: Cosm::Data.enum("yes", "no") }); Reason.schema().jsonSchema()')).toMatchObject({
    type: "object",
    required: ["answer", "choice"],
    properties: {
      answer: { type: "string" },
      choice: { enum: ["yes", "no"] },
    },
  });
});

test("cosm/ai.cosm can cast into a Data model through the runtime AI boundary", () => {
  CosmAiValue.installRuntimeHooks({
    status: () => Construct.namespace({
      backend: Construct.string("mock"),
      baseUrl: Construct.string("http://mock"),
      model: Construct.string("mock-model"),
      configured: Construct.bool(true),
    }),
    complete: (prompt) => Construct.string(`complete:${prompt}`),
    cast: (_prompt, schema) => (schema as CosmSchemaValue).validateAndReturn(ValueAdapter.jsToCosm({
      answer: "hi",
      choice: "yes",
      nested: [1, 2],
    })),
    compare: (left, right) => left.trim().toLowerCase() === right.trim().toLowerCase(),
  });

  try {
    expect(cosmEval('require "cosm/ai"; let Reason = Cosm::Data.model("Reason", { answer: Cosm::Data.string(), choice: Cosm::Data.enum("yes", "no"), nested: Cosm::Data.optional(Cosm::Data.array(Cosm::Data.number())) }); Cosm::AI.cast("Return a Reason object.", Reason.schema()).nested.length')).toBe(2);
  } finally {
    CosmAiValue.installRuntimeHooks({
      status: () => AiRuntime.status(),
      complete: (prompt) => AiRuntime.complete(prompt),
      cast: (prompt, schema) => AiRuntime.cast(prompt, schema as CosmSchemaValue),
      compare: (left, right) => AiRuntime.compare(left, right),
    });
  }
});

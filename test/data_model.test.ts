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
  expect(cosmEval("Data.class.name")).toBe("Module");
  expect(cosmEval("Data.Model.name")).toBe("DataModel");
  expect(cosmEval("cosm.Data.class.name")).toBe("Module");
  expect(cosmEval("cosm.modules.data.class.name")).toBe("Module");
  expect(cosmEval("Data.string().describe()")).toBe("Schema.string()");
  expect(cosmEval('Data.model("Reason", { answer: Data.string(), choice: Data.enum("yes", "no") }).class.name')).toBe("DataModel");
});

test("Data models support nested casts and reflective schema export", () => {
  expect(cosmEval('let Reason = Data.model("Reason", { answer: Data.string(), choice: Data.enum("yes", "no"), nested: Data.optional(Data.array(Data.number())) }); Reason.cast({ answer: "hi", choice: "yes", nested: [1, "2"] }).nested.length')).toBe(2);

  expect(cosmEval('let Reason = Data.model("Reason", { answer: Data.string(), choice: Data.enum("yes", "no") }); Reason.schema().jsonSchema()')).toMatchObject({
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
    cast: (_prompt, schema) => schema.nativeMethod("cast")!.nativeCall!([ValueAdapter.jsToCosm({
      answer: "hi",
      choice: "yes",
      nested: [1, 2],
    })], schema),
    compare: (left, right) => left.trim().toLowerCase() === right.trim().toLowerCase(),
  });

  try {
    expect(cosmEval('require("cosm/ai.cosm"); let Reason = Data.model("Reason", { answer: Data.string(), choice: Data.enum("yes", "no"), nested: Data.optional(Data.array(Data.number())) }); ai.cast("Return a Reason object.", Reason).nested.length')).toBe(2);
  } finally {
    CosmAiValue.installRuntimeHooks({
      status: () => AiRuntime.status(),
      complete: (prompt) => AiRuntime.complete(prompt),
      cast: (prompt, schema) => AiRuntime.cast(prompt, schema as CosmSchemaValue),
      compare: (left, right) => AiRuntime.compare(left, right),
    });
  }
});

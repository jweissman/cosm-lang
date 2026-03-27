import { expect, test } from "bun:test";
import { cosmEval } from "./support/cosm_eval";

test("bootstrap wires the core tower, globals, and core module roots", () => {
  expect(cosmEval("[BasicObject.name, Object.superclass.name, Module.superclass.name, Class.superclass.name]")).toEqual([
    "BasicObject",
    "BasicObject",
    "Object",
    "Module",
  ]);
  expect(cosmEval("Kernel.class.name")).toBe("Kernel");
  expect(cosmEval("Process.class.name")).toBe("Process");
  expect(cosmEval("Time.class.name")).toBe("Time");
  expect(cosmEval("Random.class.name")).toBe("Random");
  expect(cosmEval('require "cosm/data"; Cosm::Data.class.name')).toBe("Module");
  expect(cosmEval('require "cosm/test"; Cosm::Test.class.name')).toBe("Module");
});

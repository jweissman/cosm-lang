import { expect, test } from "bun:test";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";

const cosmEval = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(input));

test("example corpus exposes a stable catalog and notebook-facing wrapper", () => {
  expect(cosmEval('require "examples/spec/index"; Examples::Spec.class.name')).toBe("Module");
  expect(cosmEval('require "examples/spec/index"; Examples::Spec.catalog().length')).toBe(16);
  expect(cosmEval('require "examples/spec/index"; Examples::Spec.vm_supported().length >= 8')).toBe(true);
  expect(cosmEval('require "examples/spec/index"; Examples::Spec.vm_supported().map(->(entry) { entry.id })')).toEqual([
    "object_surface_split",
    "receiver_reflection",
    "method_lookup",
    "recursive_fib",
    "iterative_fib",
    "collections_array_hash",
    "data_model_build_validate",
    "session_notebook",
    "dispatch_helper",
  ]);
  expect(cosmEval('require "examples/spec/index"; Examples::Spec.recursive_fib().path')).toBe("examples/spec/algorithms/recursive_fib.cosm");
  expect(cosmEval('require "examples/spec/index"; Examples::Spec.recursive_fib().code')).toContain("def fib(n)");
  expect(cosmEval('require "lib/app/examples"; App::Examples.catalog().length')).toBe(16);
  expect(cosmEval('require "lib/app/examples"; App::Examples.router_sketch().code')).toContain("router.draw do");
});

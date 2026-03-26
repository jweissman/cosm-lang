import { expect, test } from "bun:test";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";

const cosmEval = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(input));

test("access-call on a class receiver can fall back to the shared send surface", () => {
  expect(cosmEval("Object.methods()")).toEqual([
    { kind: "symbol", name: "new" },
    { kind: "symbol", name: "classMethod" },
    { kind: "symbol", name: "include" },
    { kind: "symbol", name: "eq" },
    { kind: "symbol", name: "method" },
    { kind: "symbol", name: "methods" },
    { kind: "symbol", name: "send" },
    { kind: "symbol", name: "inspect" },
    { kind: "symbol", name: "to_s" },
  ]);
});

test("access-call prefers callable properties over send fallback", () => {
  expect(cosmEval(`
    let callable = ->() { 42 }
    { run: callable }.run()
  `)).toBe(42);
});

test("access-call on a non-callable property stays explicit when no message target exists", () => {
  expect(() => cosmEval('{ label: "ok" }.label()')).toThrow("Type error: attempted to call a non-function value of type string");
});

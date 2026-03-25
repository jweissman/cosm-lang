import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";

const cosmEvalVm = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.evalVm(input));

test("Interpreter.ir emits a narrow executable IR for simple programs", () => {
  expect(Cosm.Interpreter.ir("let base = 1; Kernel.dispatch(base, :plus, 2)")).toMatchObject({
    kind: "ir_program",
    instructions: expect.arrayContaining([
      { op: "push_number", value: 1 },
      { op: "store_name", name: "base" },
      { op: "call_access", name: "dispatch", argc: 3 },
      { op: "return" },
    ]),
  });
});

test("vm mode can execute a narrow subset with the same result as the interpreter", () => {
  const source = "let base = 1; Kernel.dispatch(base, :plus, 2)";
  expect(cosmEvalVm(source)).toBe(3);
  expect(cosmEvalVm(source)).toBe(ValueAdapter.cosmToJS(Cosm.Interpreter.eval(source)));
});

test("vm mode can execute if expressions and scoped blocks in a dedicated smoke file", () => {
  const source = readFileSync("test/vm.cosm", "utf8");
  expect(cosmEvalVm(source)).toBe(3);
  expect(cosmEvalVm(source)).toBe(ValueAdapter.cosmToJS(Cosm.Interpreter.eval(source)));
});

test("vm mode fails clearly on unsupported constructs", () => {
  expect(() => Cosm.Interpreter.evalVm('->() { 1 }')).toThrow("IR compile error: VM mode does not yet support 'lambda'");
});

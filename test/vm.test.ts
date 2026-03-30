import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";

const cosmEvalVm = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.evalVm(input));
const cosmEval = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(input));

test("Interpreter.ir emits a narrow executable IR for simple programs", () => {
  const baseIr = Cosm.Interpreter.ir("let base = 1; Kernel.dispatch(base, :plus, 2)");
  expect(baseIr).toMatchObject({
    kind: "ir_program",
    instructions: expect.arrayContaining([
      { op: "push_number", value: 1 },
      { op: "store_name", name: "base" },
      { op: "call_access", name: "dispatch", argc: 3 },
      { op: "return" },
    ]),
  });
  const reassignmentIr = Cosm.Interpreter.ir("base = 1; base = Kernel.dispatch(base, :plus, 2); base");
  expect(reassignmentIr).toMatchObject({
    kind: "ir_program",
    instructions: expect.arrayContaining([
      { op: "assign_name", name: "base" },
    ]),
  });
  const fibIr = Cosm.Interpreter.ir('def fib(n) if n <= 1 then n else fib(n - 1) + fib(n - 2) end end; fib(4)');
  expect(fibIr.kind).toBe("ir_program");
  expect(fibIr.instructions[0]).toMatchObject({ op: "define_function", name: "fib", params: ["n"] });
});

test("vm mode can execute a narrow subset with the same result as the interpreter", () => {
  const source = "let base = 1; Kernel.dispatch(base, :plus, 2)";
  expect(cosmEvalVm(source)).toBe(3);
  expect(cosmEvalVm(source)).toBe(ValueAdapter.cosmToJS(Cosm.Interpreter.eval(source)));
  const reassignment = "base = 1; base = Kernel.dispatch(base, :plus, 2); base";
  expect(cosmEvalVm(reassignment)).toBe(3);
  expect(cosmEvalVm(reassignment)).toBe(ValueAdapter.cosmToJS(Cosm.Interpreter.eval(reassignment)));
});

test("vm mode can execute if expressions and scoped blocks in a dedicated smoke file", () => {
  const source = readFileSync("test/fixtures/vm/basic_dispatch.cosm", "utf8");
  expect(cosmEvalVm(source)).toBe(3);
  expect(cosmEvalVm(source)).toBe(ValueAdapter.cosmToJS(Cosm.Interpreter.eval(source)));
});

test("vm mode can execute array/hash-shaped support smoke", () => {
  const source = readFileSync("test/fixtures/vm/support_transcript.cosm", "utf8");
  expect(cosmEvalVm(source)).toBe("user: hello\nassistant: Try the Reset Session button.");
  expect(cosmEvalVm(source)).toBe(ValueAdapter.cosmToJS(Cosm.Interpreter.eval(source)));
});

test("vm mode can execute controller-shaped hash and sequencing smoke", () => {
  const source = readFileSync("test/fixtures/vm/controller_conversation.cosm", "utf8");
  expect(cosmEvalVm(source)).toBe("Use the Reset Session button.");
  expect(cosmEvalVm(source)).toBe(ValueAdapter.cosmToJS(Cosm.Interpreter.eval(source)));
});

test("vm mode can execute page-shaped transcript and collection smoke", () => {
  const source = readFileSync("test/fixtures/vm/notebook_preview.cosm", "utf8");
  expect(cosmEvalVm(source)).toBe("user: hello\nassistant: hi");
  expect(cosmEvalVm(source)).toBe(ValueAdapter.cosmToJS(Cosm.Interpreter.eval(source)));
});

test("vm mode can execute page-assistant-shaped parity smoke", () => {
  const source = readFileSync("test/fixtures/vm/assistant_page.cosm", "utf8");
  expect(cosmEvalVm(source)).toBe("user: hello\nassistant: Use the Reset Session button. [offline]");
  expect(cosmEvalVm(source)).toBe(ValueAdapter.cosmToJS(Cosm.Interpreter.eval(source)));
});

test("vm-supported corpus examples pass under both interpreter and vm", () => {
  const catalog = cosmEval('require "examples/spec/index"; Examples::Spec.vm_supported()') as Array<{ path: string; expected: unknown }>;
  expect(catalog.length).toBeGreaterThanOrEqual(8);
  for (const example of catalog) {
    const source = readFileSync(example.path, "utf8");
    expect(cosmEvalVm(source)).toEqual(example.expected);
    expect(cosmEvalVm(source)).toEqual(ValueAdapter.cosmToJS(Cosm.Interpreter.eval(source)));
  }
});

test("vm mode fails clearly on unsupported constructs", () => {
  expect(() => Cosm.Interpreter.evalVm('->() { 1 }')).toThrow("IR compile error: VM mode does not yet support 'lambda'");
});

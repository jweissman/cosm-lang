import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Cosm from "../src/cosm";

const cosmEval = (input: string) => {
  const cosmValue = Cosm.Interpreter.eval(input);
  return Cosm.Values.cosmToJS(cosmValue);
};

test("2 + 2", () => {
  expect(cosmEval('2 + 2')).toBe(4);
});

test("arithmetic precedence works", () => {
  expect(cosmEval("2 + 3 * 4")).toBe(14);
  expect(cosmEval("(2 + 3) * 4")).toBe(20);
  expect(cosmEval("2 ^ 3 ^ 2")).toBe(512);
});

test("unary arithmetic works", () => {
  expect(cosmEval("-5 + +2")).toBe(-3);
  expect(cosmEval("3.5 * 2")).toBe(7);
});

test("comparisons produce booleans", () => {
  expect(cosmEval("3 < 4")).toBe(true);
  expect(cosmEval("3 >= 4")).toBe(false);
  expect(cosmEval("2 + 2 == 4")).toBe(true);
  expect(cosmEval("2 + 2 != 5")).toBe(true);
});

test("boolean logic respects precedence", () => {
  expect(cosmEval("true || false && false")).toBe(true);
  expect(cosmEval("!(2 > 3) && true")).toBe(true);
});

test("member access can inspect the class repository", () => {
  expect(cosmEval("classes.Number.name")).toBe("Number");
  expect(cosmEval("classes.Boolean.superclass.name")).toBe("Object");
  expect(cosmEval("Number.name")).toBe("Number");
});

test("values expose their class through access notation", () => {
  expect(cosmEval("(1 + 2).class.name")).toBe("Number");
  expect(cosmEval("true.class.name")).toBe("Boolean");
});

test("array and hash literals evaluate", () => {
  expect(cosmEval("[1, 2, 3]")).toEqual([1, 2, 3]);
  expect(cosmEval('{ answer: 42, ok: true, title: "cosm" }')).toEqual({ answer: 42, ok: true, title: "cosm" });
  expect(cosmEval("[1, 2].length")).toBe(2);
  expect(cosmEval("{ answer: 42 }.answer")).toBe(42);
});

test("string literals and concatenation work", () => {
  expect(cosmEval('"cosm"')).toBe("cosm");
  expect(cosmEval('"co" + "sm"')).toBe("cosm");
  expect(cosmEval('"answer: " + 42')).toBe("answer: 42");
  expect(cosmEval('"ok? " + true')).toBe("ok? true");
});

test("built-in function calls work", () => {
  expect(cosmEval("len([1, 2, 3])")).toBe(3);
  expect(cosmEval("len({ a: 1, b: 2 })")).toBe(2);
  expect(cosmEval("assert(2 + 2 == 4)")).toBe(true);
  expect(cosmEval('assert("co" + "sm" == "cosm", "strings should concatenate")')).toBe(true);
});

test("semicolon-separated programs return the last result", () => {
  expect(cosmEval("assert(len([1, 2]) == 2); 7 * 6")).toBe(42);
});

test("program-scoped let bindings work", () => {
  expect(cosmEval('let base = 40; let name = "co" + "sm"; assert(name == "cosm"); base + 2')).toBe(42);
  expect(cosmEval("let items = [1, 2, 3]; len(items)")).toBe(3);
  expect(cosmEval('let answer = 42; { value: answer }.value')).toBe(42);
});

test("blocks are scoped and value-producing", () => {
  expect(cosmEval("do let x = 1; x + 2 end")).toBe(3);
  expect(cosmEval('let x = "outer"; do let x = "inner"; assert(x == "inner"); 0 end; x')).toBe("outer");
  expect(() => cosmEval("do let x = 1; let x = 2 end")).toThrow("Name error: duplicate local 'x'");
  expect(() => cosmEval("do let x = 1 end; x")).toThrow("Name error: unknown identifier 'x'");
});

test("if expressions choose a branch and scope it", () => {
  expect(cosmEval('if true then "yes" else "no" end')).toBe("yes");
  expect(cosmEval("if false then 1 else 2 end")).toBe(2);
  expect(cosmEval('let x = "outer"; if true then do let x = "inner"; assert(x == "inner"); x end else "no" end; x')).toBe("outer");
  expect(() => cosmEval("if 1 then 2 else 3 end")).toThrow("Type error: if expects a boolean condition");
});

test("user-defined functions work", () => {
  expect(cosmEval("let id = ->(x) { x }; id(42)")).toBe(42);
  expect(cosmEval('let greet = ->(name) { "hello " + name }; greet("cosm")')).toBe("hello cosm");
  expect(cosmEval("let pair = ->(a, b) { a + b }; pair(20, 22)")).toBe(42);
  expect(cosmEval('let outer = "co"; let join = ->(rest) { outer + rest }; join("sm")')).toBe("cosm");
  expect(cosmEval('let fortyTwo = ->() { 42 }; fortyTwo()')).toBe(42);
  expect(cosmEval('def named(name) do "hi " + name end; named("cosm")')).toBe("hi cosm");
  expect(cosmEval('let prefix = "co"; def joinDef(rest) do prefix + rest end; joinDef("sm")')).toBe("cosm");
});

test("type errors stay explicit", () => {
  expect(() => cosmEval("[1] + 1")).toThrow("Type error: add expects numeric operands or string concatenation");
  expect(() => cosmEval("!1")).toThrow("Type error: not expects a boolean operand");
  expect(() => cosmEval("len(1)")).toThrow("Type error: len expects an array or hash");
  expect(() => cosmEval("1(2)")).toThrow("Type error: attempted to call a non-function value of type number");
  expect(() => cosmEval("let add = ->(a, b) { a + b }; add(1)")).toThrow("Arity error: function expects 2 arguments, got 1");
});

test("lookup and property errors stay explicit", () => {
  expect(() => cosmEval("UnknownThing")).toThrow("Name error: unknown identifier 'UnknownThing'");
  expect(() => cosmEval("classes.Number.missing")).toThrow("Property error: class Number has no property 'missing'");
  expect(() => cosmEval("assert(false)")).toThrow("Assertion failed");
  expect(() => cosmEval('assert(false, 1)')).toThrow("Type error: assert message must be a string");
  expect(() => cosmEval("let x = 1; let x = 2")).toThrow("Name error: duplicate local 'x'");
  expect(() => cosmEval("def name() do 1 end; def name() do 2 end")).toThrow("Name error: duplicate local 'name'");
  expect(() => cosmEval("let make = ->() { do let x = 1; x end }; x")).toThrow("Name error: unknown identifier 'x'");
});

test("cli can evaluate a source file", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "smoke.cosm");
  writeFileSync(sourcePath, "assert(len([1, 2, 3]) == 3); classes.Array.name\n");

  const proc = Bun.spawn(["bun", "bin/cosm", sourcePath], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  return Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]).then(([stdout, stderr, exitCode]) => {
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Array");
  });
});

test("cli can run the cosm self-test file", () => {
  const proc = Bun.spawn(["bun", "bin/cosm", "test/core.cosm"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });

  return Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]).then(([stdout, stderr, exitCode]) => {
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("String");
  });
});

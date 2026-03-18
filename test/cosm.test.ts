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
  expect(cosmEval("classes.Class.name")).toBe("Class");
  expect(cosmEval("classes.Number.class.name")).toBe("Number class");
  expect(cosmEval("Number.name")).toBe("Number");
});

test("values expose their class through access notation", () => {
  expect(cosmEval("(1 + 2).class.name")).toBe("Number");
  expect(cosmEval("true.class.name")).toBe("Boolean");
});

test("formatted output uses Cosm-oriented class names", () => {
  const classValue = Cosm.Interpreter.eval("Class");
  const classesValue = Cosm.Interpreter.eval("classes");
  expect(Cosm.Values.format(classValue)).toBe("Class");
  expect(Cosm.Values.format(classesValue)).toContain("Class: Class");
});

test("array and hash literals evaluate", () => {
  expect(cosmEval("[1, 2, 3]")).toEqual([1, 2, 3]);
  expect(cosmEval('{ answer: 42, ok: true, title: "cosm" }')).toEqual({ answer: 42, ok: true, title: "cosm" });
  expect(cosmEval("[1, 2].length")).toBe(2);
  expect(cosmEval("{ answer: 42 }.length")).toBe(1);
  expect(cosmEval("{ answer: 42 }.answer")).toBe(42);
});

test("string literals and concatenation work", () => {
  expect(cosmEval('"cosm"')).toBe("cosm");
  expect(cosmEval('"cosm".length')).toBe(4);
  expect(cosmEval('"co" + "sm"')).toBe("cosm");
  expect(cosmEval('"co".plus("sm")')).toBe("cosm");
  expect(cosmEval('"answer: " + 42')).toBe("answer: 42");
  expect(cosmEval('"answer: ".plus(42)')).toBe("answer: 42");
  expect(cosmEval('"ok? " + true')).toBe("ok? true");
  expect(cosmEval('"hello #{1 + 1}"')).toBe("hello 2");
  expect(cosmEval('let name = "cosm"; "hello #{name}"')).toBe("hello cosm");
  expect(cosmEval('"#{true} #{42}"')).toBe("true 42");
  expect(cosmEval('"# not interpolation"')).toBe("# not interpolation");
});

test("built-in function calls work", () => {
  expect(cosmEval("[1, 2, 3].length")).toBe(3);
  expect(cosmEval('"cosm".length')).toBe(4);
  expect(cosmEval("{ a: 1, b: 2 }.length")).toBe(2);
  expect(cosmEval("assert(2 + 2 == 4)")).toBe(true);
  expect(cosmEval('assert("co" + "sm" == "cosm", "strings should concatenate")')).toBe(true);
});

test("semicolon-separated programs return the last result", () => {
  expect(cosmEval("assert([1, 2].length == 2); 7 * 6")).toBe(42);
});

test("program-scoped let bindings work", () => {
  expect(cosmEval('let base = 40; let name = "co" + "sm"; assert(name == "cosm"); base + 2')).toBe(42);
  expect(cosmEval("let items = [1, 2, 3]; items.length")).toBe(3);
  expect(cosmEval('let answer = 42; { value: answer }.value')).toBe(42);
});

test("session environments can retain bindings across evaluations", () => {
  const env = Cosm.Interpreter.createEnv();
  expect(Cosm.Values.cosmToJS(Cosm.Interpreter.evalInEnv("let a = 4", env))).toBe(4);
  expect(Cosm.Values.cosmToJS(Cosm.Interpreter.evalInEnv('"a=#{a}"', env))).toBe("a=4");
});

test("line comments are ignored by the parser", () => {
  expect(cosmEval('# heading comment\n40 + 2')).toBe(42);
  expect(cosmEval('let answer = 42; # keep this around\nanswer')).toBe(42);
  expect(cosmEval('let answer = 40;\n# comment between statements\nanswer + 2')).toBe(42);
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

test("classes can be defined and reflected on", () => {
  expect(cosmEval("class Point do end; Point.name")).toBe("Point");
  expect(cosmEval("class Point do end; classes.Point.name")).toBe("Point");
  expect(cosmEval("class Point do end; Point.class.name")).toBe("Point class");
  expect(cosmEval("class Point < Number do end; Point.class.superclass.name")).toBe("Number class");
  expect(cosmEval("Class.class.name")).toBe("Class");
  expect(cosmEval("class Point < Number do end; Point.superclass.name")).toBe("Number");
  expect(cosmEval("1.plus(2)")).toBe(3);
  expect(cosmEval("class Pair do def init(left, right) do true end end; Pair.slots.length")).toBe(2);
  expect(cosmEval("class Pair do def init(left, right) do true end; def sum() do @left + @right end end; let pair = Pair.new(1, 2); pair.sum()")).toBe(3);
  expect(cosmEval('class Greeter do def greet(name) do "hello " + name end end; Greeter.methods.greet.name')).toBe("greet");
  expect(cosmEval('class Greeter do def self.label() do self.name + "!" end end; Greeter.classMethods.label.name')).toBe("label");
  expect(cosmEval('class Greeter do def kind() do self.class.name end end; let g = Greeter.new(); g.kind()')).toBe("Greeter");
  expect(cosmEval('class Greeter do def self.label() do self.name + "!" end end; Greeter.label()')).toBe("Greeter!");
  expect(cosmEval('class Greeter do def self.kind() do self.class.name end end; Greeter.kind()')).toBe("Greeter class");
  expect(cosmEval('class Base do def self.label() do "base" end end; class Child < Base do end; Child.label()')).toBe("base");
  expect(cosmEval('class Base do def init(left) do true end; def kind() do "base #{@left}" end end; class Child < Base do def init(right) do assert(@left == 1) end end; let child = Child.new(1, 2); child.kind()')).toBe("base 1");
  expect(cosmEval('class Checked do def init(value) do assert(@value == value) end end; Checked.new(4).value')).toBe(4);
  expect(cosmEval('class Pair do def init(left, right) do true end; def label() do "#{@left}:#{@right}" end end; Pair.new(1, 2).label()')).toBe("1:2");
  expect(cosmEval('class Point do end; Point.new().class.name')).toBe("Point");
});

test("type errors stay explicit", () => {
  expect(() => cosmEval("[1] + 1")).toThrow("Type error: add expects numeric operands or string concatenation");
  expect(() => cosmEval("!1")).toThrow("Type error: not expects a boolean operand");
  expect(() => cosmEval("len(1)")).toThrow("Name error: unknown identifier 'len'");
  expect(() => cosmEval("1(2)")).toThrow("Type error: attempted to call a non-function value of type number");
  expect(() => cosmEval("let add = ->(a, b) { a + b }; add(1)")).toThrow("Arity error: function expects 2 arguments, got 1");
  expect(() => cosmEval('"value: #{[1]}"')).toThrow("Type error: cannot interpolate value of type array into a string");
  expect(() => cosmEval("1.plus(true)")).toThrow("Type error: add expects numeric operands or string concatenation");
});

test("lookup and property errors stay explicit", () => {
  expect(() => cosmEval("UnknownThing")).toThrow("Name error: unknown identifier 'UnknownThing'");
  expect(() => cosmEval("classes.Number.missing")).toThrow("Property error: class Number has no property 'missing'");
  expect(() => cosmEval("assert(false)")).toThrow("Assertion failed");
  expect(() => cosmEval('assert(false, 1)')).toThrow("Type error: assert message must be a string");
  expect(() => cosmEval("let x = 1; let x = 2")).toThrow("Name error: duplicate local 'x'");
  expect(() => cosmEval("def name() do 1 end; def name() do 2 end")).toThrow("Name error: duplicate local 'name'");
  expect(() => cosmEval("let make = ->() { do let x = 1; x end }; x")).toThrow("Name error: unknown identifier 'x'");
  expect(() => cosmEval("class Thing < UnknownThing do end")).toThrow("Name error: unknown identifier 'UnknownThing'");
  expect(() => cosmEval("class Thing do def go() do 1 end; def go() do 2 end end")).toThrow("Name error: duplicate method 'go' in class 'Thing'");
  expect(() => cosmEval("class Greeter do def label() do self.name end end; Greeter.label()")).toThrow("Property error: class Greeter has no property 'label'");
  expect(() => cosmEval("class Thing do def init(value) do true end end; Thing.new()")).toThrow("Arity error: Thing.new expects 1 arguments, got 0");
  expect(() => cosmEval("class Thing do def init(value, value) do true end end")).toThrow("Name error: duplicate slot 'value' in class 'Thing'");
  expect(() => cosmEval("@value")).toThrow("Name error: ivar access '@value' requires self");
  expect(() => cosmEval("class Thing do def init(value) do true end; def missing() do @other end end; Thing.new(1).missing()")).toThrow("Property error: object of class Thing has no ivar '@other'");
  expect(() => cosmEval("let class = 1")).toThrow("Parse error:");
  expect(() => cosmEval("let self = 1")).toThrow("Parse error:");
});

test("cli can evaluate a source file", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "cosm-lang-"));
  const sourcePath = join(tempDir, "smoke.cosm");
  writeFileSync(sourcePath, "assert([1, 2, 3].length == 3); assert(\"cosm\".length == 4); assert({ a: 1, b: 2 }.length == 2); classes.Array.name\n");

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

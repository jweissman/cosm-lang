import { expect, test } from "bun:test";
import { cosmEval } from "./support/cosm_eval";

test("2 + 2", () => {
  expect(cosmEval("2 + 2")).toBe(4);
});

test("arithmetic precedence works", () => {
  expect(cosmEval("2 + 3 * 4")).toBe(14);
  expect(cosmEval("(2 + 3) * 4")).toBe(20);
  expect(cosmEval("2 ^ 3 ^ 2")).toBe(512);
});

test("unary arithmetic works", () => {
  expect(cosmEval("-5 + +2")).toBe(-3);
  expect(cosmEval("3.5 * 2")).toBe(7);
  expect(cosmEval("5.neg()")).toBe(-5);
});

test("comparisons produce booleans", () => {
  expect(cosmEval("3 < 4")).toBe(true);
  expect(cosmEval("3 >= 4")).toBe(false);
  expect(cosmEval("2 + 2 == 4")).toBe(true);
  expect(cosmEval("2 + 2 != 5")).toBe(true);
  expect(cosmEval('"co" == "co"')).toBe(true);
  expect(cosmEval(":ok == :ok")).toBe(true);
  expect(cosmEval("true == true")).toBe(true);
  expect(cosmEval("[1, 2] == [1, 2]")).toBe(true);
  expect(cosmEval('{ answer: 42 } == { answer: 42 }')).toBe(true);
  expect(cosmEval('class Pair do def init(left, right) true end end; Pair.new(1, 2) == Pair.new(1, 2)')).toBe(true);
  expect(cosmEval("3.send(:lt, 4)")).toBe(true);
  expect(cosmEval("3.send(:gte, 4)")).toBe(false);
  expect(cosmEval(":ok.send(:eq, :ok)")).toBe(true);
  expect(cosmEval('"co".send(:eq, "co")')).toBe(true);
  expect(cosmEval("[1, 2].send(:eq, [1, 2])")).toBe(true);
});

test("boolean logic respects precedence", () => {
  expect(cosmEval("true || false && false")).toBe(true);
  expect(cosmEval("!(2 > 3) && true")).toBe(true);
  expect(cosmEval("true.and(false)")).toBe(false);
  expect(cosmEval("false.or(true)")).toBe(true);
  expect(cosmEval("true.not()")).toBe(false);
});

test("ternary is a compact expression form", () => {
  expect(cosmEval('true ? "yes" : "no"')).toBe("yes");
  expect(cosmEval('false ? "yes" : "no"')).toBe("no");
  expect(cosmEval('let value = 4; value > 3 ? "big" : "small"')).toBe("big");
});

test("one-line defs are a compact callable form", () => {
  expect(cosmEval('def status = "ok"; status()')).toBe("ok");
  expect(cosmEval('def add(x, y) = x + y; add(20, 22)')).toBe(42);
  expect(cosmEval('def join(head, *tail) = tail.length; join("a", "b", "c")')).toBe(2);
  expect(cosmEval('class Greeter do def label = "hi" end; Greeter.new().label()')).toBe("hi");
});

test("bare assignment introduces and reassigns locals", () => {
  expect(cosmEval("answer = 41; answer = answer + 1; answer")).toBe(42);
  expect(cosmEval("value = 1; do value = value + 1 end; value")).toBe(2);
  expect(cosmEval("value = 1; do inner = 2 end; value")).toBe(1);
  expect(() => cosmEval("yield = 1")).toThrow();
});

test("rest args and hash shorthand improve local ergonomics", () => {
  expect(cosmEval("def collect(head, *tail) = tail; collect(1, 2, 3)")).toEqual([2, 3]);
  expect(cosmEval("let collect = ->(head, *tail) { tail }; collect(1, 2, 3)")).toEqual([2, 3]);
  expect(cosmEval('def greet(name = "cosm", *rest) = { name, rest }; greet()')).toEqual({ name: "cosm", rest: [] });
  expect(cosmEval("foo = 1; bar = 2; { foo, bar }")).toEqual({ foo: 1, bar: 2 });
  expect(cosmEval("foo = 1; { foo, bar: 2 }")).toEqual({ foo: 1, bar: 2 });
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
  expect(cosmEval("'cosm'")).toBe("cosm");
  expect(cosmEval("'line\\nnext'")).toBe("line\nnext");
  expect(cosmEval("'#{1 + 1}'")).toBe("#{1 + 1}");
  expect(cosmEval('let name = "cosm"; """<h1>Hello #{name}</h1>"""')).toBe("<h1>Hello cosm</h1>");
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
  expect(cosmEval("assert true")).toBe(true);
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

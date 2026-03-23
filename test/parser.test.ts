import { expect, test } from "bun:test";
import { Parser } from "../src/ast/parser";

test("parser accepts single-quoted strings", () => {
  expect(() => Parser.parse("'hello'")).not.toThrow();
  expect(() => Parser.parse("puts 'hello'")).not.toThrow();
});

test("parser accepts narrow bare-call sugar", () => {
  expect(() => Parser.parse("assert true")).not.toThrow();
  expect(() => Parser.parse("Kernel.puts 'hello'")).not.toThrow();
  expect(() => Parser.parse("puts :ok")).not.toThrow();
});

test("parser accepts require and optional do elision", () => {
  expect(() => Parser.parse('require("cosm/test")')).not.toThrow();
  expect(() => Parser.parse('def greet(name) "hi " + name end; greet("cosm")')).not.toThrow();
  expect(() => Parser.parse('class Greeter def label() "hi" end end; Greeter.name')).not.toThrow();
});

test("parser keeps keyword prefixes distinct from identifiers", () => {
  expect(() => Parser.parse("do double() end")).not.toThrow();
  expect(() => Parser.parse("do doThing() end")).not.toThrow();
  expect(() => Parser.parse("let double = 1; do double end")).not.toThrow();
});

test("parser keeps bare-call sugar statement-oriented", () => {
  expect(() => Parser.parse("assert(assert true == true)")).toThrow("Parse error:");
  expect(() => Parser.parse("->() { assert true }")).toThrow("Parse error:");
});

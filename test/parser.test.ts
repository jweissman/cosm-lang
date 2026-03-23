import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
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
  expect(() => Parser.parse('class App\n  def handle(req)\n    HttpResponse.text(respond(req), 200)\n  end\n  def respond(req)\n    hello(req.path)\n  end\n  def hello(subject)\n    "Hello #{subject}"\n  end\nend; let app = App.new();')).not.toThrow();
  expect(() => Parser.parse('class Greeter\n  class << self\n    def label()\n      "hi"\n    end\n  end\nend\nGreeter.label()')).not.toThrow();
});

test("parser treats significant newlines like semicolons", () => {
  expect(() => Parser.parse("let a = 1\nlet b = 2\nb")).not.toThrow();
  expect(() => Parser.parse("class A\nend\nA.name")).not.toThrow();
  expect(() => Parser.parse("def f() 1 end\ndef g() 2 end\ng()")).not.toThrow();
  expect(() => Parser.parse("1 +\n2")).not.toThrow();
});

test("parser keeps keyword prefixes distinct from identifiers", () => {
  expect(() => Parser.parse("do double() end")).not.toThrow();
  expect(() => Parser.parse("do doThing() end")).not.toThrow();
  expect(() => Parser.parse("let double = 1; do double end")).not.toThrow();
  expect(() => Parser.parse("class Echo def does_not_understand(message, args) message end end")).not.toThrow();
});

test("parser accepts interpolated triple-quoted strings", () => {
  expect(() => Parser.parse('let name = "cosm"\n"""\n<h1>Hello #{name}</h1>\n"""')).not.toThrow();
});

test("parser accepts multi-statement lambdas with bare calls", () => {
  expect(() => Parser.parse('->(req) { puts "#{Time.isoNow()}"; HttpResponse.html("""<h1>Hello #{req.path}</h1>""", 200) }')).not.toThrow();
});

test("parser lowers trailing do-end blocks on calls", () => {
  expect(() => Parser.parse('router.draw do get("/", ->(req) { HttpResponse.text("hi", 200) }) end')).not.toThrow();
  expect(() => Parser.parse('describe("smoke") do test("ok", ->() { assert(true) }) end')).not.toThrow();
  expect(() => Parser.parse('do let x = 1; x end')).not.toThrow();
  expect(() => Parser.parse('router.draw do |req| req end')).toThrow("Parse error:");
});

test("parser keeps bare-call sugar statement-oriented", () => {
  expect(() => Parser.parse("assert(assert true == true)")).toThrow("Parse error:");
  expect(() => Parser.parse("->() { assert true }")).not.toThrow();
});

test("parser accepts the canonical app/server.cosm shape", () => {
  expect(() => Parser.parse(readFileSync("app/server.cosm", "utf8"))).not.toThrow();
  expect(() => Parser.parse(readFileSync("app/app.cosm", "utf8"))).not.toThrow();
});

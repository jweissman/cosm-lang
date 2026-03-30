import { expect, test } from "bun:test";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";
import { cosmEval } from "./support/cosm_eval";

test("session environments can retain bindings across evaluations", () => {
  const env = Cosm.Interpreter.createEnv();
  expect(ValueAdapter.cosmToJS(Cosm.Interpreter.evalInEnv("let a = 4", env))).toBe(4);
  expect(ValueAdapter.cosmToJS(Cosm.Interpreter.evalInEnv('"a=#{a}"', env))).toBe("a=4");
});

test("line comments are ignored by the parser", () => {
  expect(cosmEval("# heading comment\n40 + 2")).toBe(42);
  expect(cosmEval("let answer = 42; # keep this around\nanswer")).toBe(42);
  expect(cosmEval("let answer = 40;\n# comment between statements\nanswer + 2")).toBe(42);
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
  expect(cosmEval("if nihil then 1 else 2 end")).toBe(2);
  expect(cosmEval('let x = "outer"; if true then do let x = "inner"; assert(x == "inner"); x end else "no" end; x')).toBe("outer");
  expect(() => cosmEval("if 1 then 2 else 3 end")).toThrow("Type error: if expects a boolean condition");
});

test("nihil and core predicates make absence explicit", () => {
  expect(cosmEval("nihil")).toBeNull();
  expect(cosmEval("Kernel.inspect(nihil)")).toBe("nihil");
  expect(cosmEval("nihil.class.name")).toBe("Nihil");
  expect(cosmEval("nihil.nihil?()")).toBe(true);
  expect(cosmEval("nihil.falsy?()")).toBe(true);
  expect(cosmEval("false.falsy?()")).toBe(true);
  expect(cosmEval("true.truthy?()")).toBe(true);
  expect(cosmEval('"cosm".present?()')).toBe(true);
});

test("user-defined functions work", () => {
  expect(cosmEval("let id = ->(x) { x }; id(42)")).toBe(42);
  expect(cosmEval("let id = ->(x) { x }; id.call(42)")).toBe(42);
  expect(cosmEval('def greet name = "hi " + name; greet("cosm")')).toBe("hi cosm");
  expect(cosmEval('def greet(name) "hi " + name end; greet("cosm")')).toBe("hi cosm");
  expect(cosmEval('def greet(name = "cosm") "hi " + name end; greet()')).toBe("hi cosm");
  expect(cosmEval('def greet(name = "cosm") "hi " + name end; greet("runtime")')).toBe("hi runtime");
  expect(cosmEval('def pair(left, right = left + "!") right end; pair("cosm")')).toBe("cosm!");
  expect(cosmEval('let greet = ->(name) { "hello " + name }; greet("cosm")')).toBe("hello cosm");
  expect(cosmEval('let greet = ->(name = "cosm") { "hello " + name }; greet()')).toBe("hello cosm");
  expect(cosmEval('let greet = ->(name = "runtime") { "hello " + name }; greet("cosm")')).toBe("hello cosm");
  expect(cosmEval("let pair = ->(a, b) { a + b }; pair(20, 22)")).toBe(42);
  expect(cosmEval('let outer = "co"; let join = ->(rest) { outer + rest }; join("sm")')).toBe("cosm");
  expect(cosmEval('let fortyTwo = ->() { 42 }; fortyTwo()')).toBe(42);
  expect(cosmEval('def named(name) do "hi " + name end; named("cosm")')).toBe("hi cosm");
  expect(cosmEval('let prefix = "co"; def joinDef(rest) do prefix + rest end; joinDef("sm")')).toBe("cosm");
  expect(cosmEval('require "cosm/ai"; Cosm::AI.status.class_name()')).toBe("Namespace");
});

test("explicit ivar assignment and symbol-derived callables work in ordinary authored code", () => {
  expect(cosmEval(`
    class Box
      def init(value)
        @value = value
      end

      def current = @value
    end

    Box.new(4).current
  `)).toBe(4);
  expect(cosmEval('[1, 2, 3].map(:to_s.to_fn())')).toEqual(["1", "2", "3"]);
  expect(cosmEval('[1].presence().class_name()')).toBe("Array");
  expect(cosmEval('[].presence().nihil?()')).toBe(true);
  expect(cosmEval('Array.includes_module?("Enumerable")')).toBe(true);
  expect(cosmEval('Array.ancestor_names()')).toEqual(["Array", "Object", "BasicObject"]);
  expect(cosmEval('Array.instance_method_names().find(->(name) { name == "compact_blank" }).nihil?()')).toBe(false);
  expect(cosmEval('HttpResponse.class_method(:json).name')).toBe("json");
  expect(cosmEval('[1, 2, 3].second()')).toBe(2);
  expect(cosmEval('[1].second().nihil?()')).toBe(true);
  expect(cosmEval('Session.default.history.length')).toBeGreaterThanOrEqual(0);
  expect(cosmEval('"cosm".is_a?("String")')).toBe(true);
  expect(cosmEval('"cosm".responds_to?(:to_s)')).toBe(true);
  expect(cosmEval('[1, nihil, "", 2].compact_blank()')).toEqual([1, 2]);
  expect(cosmEval('{ answer: 42 }.fetch(:answer)')).toBe(42);
  expect(cosmEval('{ }.fetch(:answer, "fallback")')).toBe("fallback");
});

test("yield invokes the current implicit trailing block", () => {
  expect(cosmEval(`
    def withValue(value)
      yield(value + 1)
    end
    withValue(41) do |number|
      number
    end
  `)).toBe(42);
  expect(cosmEval(`
    def outer()
      let inner = ->() { yield("nested") }
      inner()
    end
    outer() do |label|
      label
    end
  `)).toBe("nested");
  expect(() => cosmEval("yield()")).toThrow("Block error: yield called without a current block");
});

test("implicit self dispatch works for unresolved bare calls", () => {
  expect(cosmEval('class Greeter do def hello(name) do "hi " + name end; def callHello(name) do hello(name) end end; Greeter.new().callHello("cosm")')).toBe("hi cosm");
  expect(cosmEval('class Greeter do def self.label() do "Greeter!" end; def self.callLabel() do label() end end; Greeter.callLabel()')).toBe("Greeter!");
  expect(cosmEval('class Counter do def init(value) do @value = value end; def current() do value end end; Counter.new(4).current()')).toBe(4);
  expect(cosmEval('class Base do def greet(name) do "hi " + name end end; class Child < Base do def greet(name) do super(name) + "!" end end; Child.new().greet("cosm")')).toBe("hi cosm!");
});

test("classes can be defined and reflected on", () => {
  expect(cosmEval("class Point do end; Point.name")).toBe("Point");
  expect(cosmEval("class Point do end; classes.Point.name")).toBe("Point");
  expect(cosmEval("class Point do end; Point.class.name")).toBe("Point class");
  expect(cosmEval("class Point do end; Point.metaclass.name")).toBe("Point class");
  expect(cosmEval("class Point do end; Point.metaclass.class.name")).toBe("Class");
  expect(cosmEval("class Point < Number do end; Point.class.superclass.name")).toBe("Number class");
  expect(cosmEval("class Point < Number do end; Point.metaclass.superclass.name")).toBe("Number class");
  expect(cosmEval("Class.class.name")).toBe("Class");
  expect(cosmEval("class Point < Number do end; Point.superclass.name")).toBe("Number");
  expect(cosmEval("1.plus(2)")).toBe(3);
  expect(cosmEval("class Pair do def init(left, right) do @left = left; @right = right end end; Pair.slots.length")).toBe(2);
  expect(cosmEval("class Pair do def init(left, right) do @left = left; @right = right end; def sum() do @left + @right end end; let pair = Pair.new(1, 2); pair.sum()")).toBe(3);
  expect(cosmEval('class Greeter do def greet(name) do "hello " + name end end; Greeter.method(:greet).name')).toBe("greet");
  expect(cosmEval('class Greeter def greet(name) "hello " + name end end; Greeter.method(:greet).name')).toBe("greet");
  expect(cosmEval('class Greeter do def self.label() do self.name + "!" end end; Greeter.classMethod(:label).name')).toBe("label");
  expect(cosmEval('class Greeter do def self.label() do self.name + "!" end end; Greeter.classMethod(:label)()')).toBe("Greeter!");
  expect(cosmEval('class Greeter do def self.label() do self.name + "!" end end; Greeter.classMethod(:label).call()')).toBe("Greeter!");
  expect(cosmEval('class Greeter do def kind() do self.class.name end end; let g = Greeter.new(); g.kind()')).toBe("Greeter");
  expect(cosmEval('class Greeter do def self.label() do self.name + "!" end end; Greeter.label()')).toBe("Greeter!");
  expect(cosmEval('class Greeter\n  class << self\n    def label()\n      self.name + "!"\n    end\n  end\nend\nGreeter.label()')).toBe("Greeter!");
  expect(cosmEval('class Greeter do def self.kind() do self.class.name end end; Greeter.kind()')).toBe("Greeter class");
  expect(cosmEval('class Base do def self.label() do "base" end end; class Child < Base do end; Child.label()')).toBe("base");
  expect(cosmEval('class Base do def self.label() do "base" end end; class Child < Base do end; Child.metaclass.superclass.name')).toBe("Base class");
  expect(cosmEval('class Base do def self.label(name) do "base " + name end end; class Child < Base do def self.label(name) do super(name) + "!" end end; Child.label("cosm")')).toBe("base cosm!");
  expect(cosmEval('class Base do def init(left) do @left = left end; def kind() do "base #{@left}" end end; class Child < Base do def init(right) do @right = right; assert(@left == 1) end end; let child = Child.new(1, 2); child.kind()')).toBe("base 1");
  expect(cosmEval('class Checked do def init(value) do @value = value; assert(@value == value) end end; Checked.new(4).value')).toBe(4);
  expect(cosmEval('class Pair do def init(left, right) do @left = left; @right = right end; def label() do "#{@left}:#{@right}" end end; Pair.new(1, 2).label()')).toBe("1:2");
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
  expect(() => cosmEval("Symbol.intern(1)")).toThrow("Type error: Symbol.intern expects a string argument");
  expect(() => cosmEval("1.send(1, 2)")).toThrow("Type error: send expects a string or symbol message, got number");
  expect(() => cosmEval("Kernel.method(:missing)")).toThrow("Property error: object of class Kernel has no property 'missing'");
  expect(() => cosmEval("super(1)")).toThrow("Super error: super(...) called outside a method");
  expect(() => cosmEval("class Base do end; class Child < Base do def greet() do super() end end; Child.new().greet()")).toThrow("Super error: greet does not have a super target");
});

test("lookup and property errors stay explicit", () => {
  expect(() => cosmEval("UnknownThing")).toThrow("Name error: unknown identifier 'UnknownThing'");
  expect(() => cosmEval("classes.Number.missing")).toThrow("Property error: class Number has no property 'missing'");
  expect(() => cosmEval("Kernel.missing")).toThrow("Property error: object of class Kernel has no property 'missing'");
  expect(() => cosmEval("classes.Kernel.classMethod(:assert)")).toThrow("Property error: class Kernel has no class method 'assert'");
  expect(() => cosmEval("assert(false)")).toThrow("Assertion failed");
  expect(() => cosmEval("Kernel.assert(false)")).toThrow("Assertion failed");
  expect(() => cosmEval('assert(false, 1)')).toThrow("Type error: assert message must be a string");
  expect(() => cosmEval("let x = 1; let x = 2")).toThrow("Name error: duplicate local 'x'");
  expect(() => cosmEval("def name() do 1 end; def name() do 2 end")).toThrow("Name error: duplicate local 'name'");
  expect(() => cosmEval("let make = ->() { do let x = 1; x end }; x")).toThrow("Name error: unknown identifier 'x'");
  expect(() => cosmEval("class Thing < UnknownThing do end")).toThrow("Name error: unknown identifier 'UnknownThing'");
  expect(() => cosmEval("class Thing do def go() do 1 end; def go() do 2 end end")).toThrow("Name error: duplicate method 'go' in class 'Thing'");
  expect(() => cosmEval("class Greeter do def label() do self.name end end; Greeter.label()")).toThrow("Property error: class Greeter has no property 'label'");
  expect(() => cosmEval("class Thing do def init(value) do true end end; Thing.new()")).toThrow("Arity error: Thing.new expects 1 arguments, got 0");
  expect(() => cosmEval('def greet(name = "cosm", suffix) do name + suffix end; greet()')).toThrow("Arity error: function expects 2 arguments, got 0");
  expect(() => cosmEval("class Thing do def init(value, value) do true end end")).toThrow("Name error: duplicate slot 'value' in class 'Thing'");
  expect(() => cosmEval("@value")).toThrow("Name error: ivar access '@value' requires self");
  expect(() => cosmEval("class Thing do def init(value) do true end; def missing() do @other end end; Thing.new(1).missing()")).toThrow("Property error: object of class Thing has no ivar '@other'");
  expect(() => cosmEval("let class = 1")).toThrow("Parse error:");
  expect(() => cosmEval("let self = 1")).toThrow("Parse error:");
  expect(() => cosmEval("[1, 2].map(:to_s.to_fn())")).not.toThrow();
});

test("Kernel.raise keeps message, details, and error-object forms explicit", () => {
  expect(cosmEval('Kernel.try(->() { Kernel.raise("boom") }).error.message')).toBe("boom");
  expect(cosmEval('Kernel.try(->() { Kernel.raise("boom", { code: 7 }) }).error.details.code')).toBe(7);
  expect(cosmEval('error = Error.new("boom", { code: 9 }); Kernel.try(->() { Kernel.raise(error) }).error.details.code')).toBe(9);
});

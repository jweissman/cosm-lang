import { expect, test } from "bun:test";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";

const cosmEval = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(input));

test("Kernel.inspect delegates to representative runtime values cleanly", () => {
  expect(cosmEval("Kernel.inspect(Kernel)")).toBe("#<Kernel>");
  expect(cosmEval('Kernel.inspect(HttpResponse.text("ok", 201))')).toBe('#<HttpResponse 201 "ok">');
  expect(cosmEval("Kernel.inspect(HttpRouter.new())")).toBe("#<HttpRouter routes: 0>");
});

test("Kernel.inspect respects user-defined inspect methods", () => {
  expect(cosmEval(`
    class Painter
      def inspect()
        "<Painter custom>"
      end
    end
    Kernel.inspect(Painter.new())
  `)).toBe("<Painter custom>");
});

test("receiver-side inspect stays available on representative objects", () => {
  expect(cosmEval('Symbol.intern("ok").inspect()')).toBe(":ok");
  expect(cosmEval('Error.new("boom").inspect()')).toBe('#<Error "boom">');
  expect(cosmEval('Schema.string().inspect()')).toBe("Schema.string()");
});

test("receiver-side methods() exposes visible reflective methods consistently", () => {
  expect(cosmEval("Object.new().methods()")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "send" }]));
  expect(cosmEval("Object.methods()")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "send" }, { kind: "symbol", name: "new" }]));
  expect(cosmEval("1.methods()")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "plus" }]));
  expect(cosmEval("Kernel.methods()")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "assert" }, { kind: "symbol", name: "dispatch" }]));
  expect(cosmEval("HttpRouter.new().method(:draw).name")).toBe("draw");
  expect(cosmEval("classes.Object.methods.get(:send).name")).toBe("send");
});

test("receiver-side methods() includes inherited methods and agrees with method(:name)", () => {
  expect(cosmEval(`
    class Base
      def greet()
        "hi"
      end
    end
    class Child < Base
    end
    Child.new().methods()
  `)).toEqual(expect.arrayContaining([{ kind: "symbol", name: "greet" }]));
  expect(cosmEval(`
    class Base
      def greet()
        "hi"
      end
    end
    class Child < Base
    end
    Child.new().method(:greet).name
  `)).toBe("greet");
  expect(cosmEval(`
    require("support/label_mixin.cosm")
    class Mixed
    end
    Mixed.include(label_mixin)
    Mixed.new().methods()
  `)).toEqual(expect.arrayContaining([{ kind: "symbol", name: "label" }, { kind: "symbol", name: "emphasize" }]));
  expect(cosmEval(`
    require("support/label_mixin.cosm")
    class Mixed
      def label()
        "local"
      end
    end
    Mixed.include(label_mixin)
    Mixed.new().label()
  `)).toBe("local");
  expect(cosmEval(`
    require("support/label_mixin.cosm")
    class BaseMixed
    end
    BaseMixed.include(label_mixin)
    class ChildMixed < BaseMixed
    end
    ChildMixed.new().method(:label).name
  `)).toBe("label");
  expect(cosmEval(`
    require("support/label_mixin.cosm")
    class Mixed
    end
    Mixed.include(label_mixin)
    Mixed.new().method(:label).name
  `)).toBe("label");
});

test("Mirror inspect remains wrapper-visible", () => {
  expect(cosmEval("Kernel.inspect(Mirror.reflect([1, 2]))")).toBe("#<Mirror [1, 2]>");
  expect(cosmEval('Mirror.reflect(HttpRouter.new()).inspect()')).toBe('#<Mirror #<HttpRouter routes: 0>>');
  expect(cosmEval("Mirror.reflect(Object.new()).methods()")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "send" }]));
  expect(cosmEval(`
    class Base
      def greet()
        "hi"
      end
    end
    class Child < Base
    end
    Mirror.reflect(Child.new()).methods()
  `)).toEqual(expect.arrayContaining([{ kind: "symbol", name: "greet" }]));
});

test("print and puts use receiver-side to_s for non-strings", () => {
  let stdout = "";
  const originalWrite = process.stdout.write;
  (process.stdout as unknown as { write: typeof process.stdout.write }).write = ((chunk: string | Uint8Array) => {
    stdout += String(chunk);
    return true;
  }) as typeof process.stdout.write;

  try {
    cosmEval(`
      class Printable
        def to_s()
          "custom-output"
        end
      end
      Kernel.print(Printable.new())
      Kernel.puts(Printable.new())
    `);
  } finally {
    (process.stdout as unknown as { write: typeof process.stdout.write }).write = originalWrite;
  }

  expect(stdout).toContain("custom-output");
  expect(stdout).toContain("custom-output\n");
});

test("core scalar values expose explicit conversion helpers", () => {
  expect(cosmEval('"42".to_i()')).toBe(42);
  expect(cosmEval('"3.5".to_f()')).toBe(3.5);
  expect(cosmEval("4.9.to_i()")).toBe(4);
  expect(cosmEval("4.to_f()")).toBe(4);
  expect(cosmEval(":status.to_s()")).toBe("status");
});

test("Array and Hash pick up small Enumerable-style helpers through include()", () => {
  expect(cosmEval("[1, 2, 3].count()")).toBe(3);
  expect(cosmEval("[].empty()")).toBe(true);
  expect(cosmEval('{ answer: 42 }.present()')).toBe(true);
  expect(cosmEval("[1, 2, 3].any()")).toBe(true);
  expect(cosmEval("[1, 2, 3].any(->(value) { value > 2 })")).toBe(true);
  expect(cosmEval("[1, 2, 3].all(->(value) { value > 0 })")).toBe(true);
  expect(cosmEval("[].none()")).toBe(true);
  expect(cosmEval("[1].one()")).toBe(true);
  expect(cosmEval("[1, 2, 3].filter(->(value) { value > 1 })")).toEqual([2, 3]);
  expect(cosmEval("[1, false, 3].compact()")).toEqual([1, 3]);
  expect(cosmEval("[1, 2].flatMap(->(value) { [value, value + 10] })")).toEqual([1, 11, 2, 12]);
  expect(cosmEval("[1, 2, 3].sum()")).toBe(6);
  expect(cosmEval("[1, 2, 3].first()")).toBe(1);
  expect(cosmEval('[1, 2, 3].find(->(value) { value > 1 })')).toBe(2);
  expect(cosmEval('[1, 2, 3].reject(->(value) { value > 1 })')).toEqual([1]);
  expect(cosmEval('[1, 2, 3].take(2)')).toEqual([1, 2]);
  expect(cosmEval('[1, 2, 3].reduce(0, ->(acc, value) { acc + value })')).toBe(6);
  expect(cosmEval('["co", "sm"].join("-")')).toBe("co-sm");
  expect(cosmEval('{ a: 1, b: 2 }.first()')).toEqual(["a", 1]);
  expect(cosmEval('{ a: 1, b: 2 }.find(->(key, value) { value > 1 })')).toEqual(["b", 2]);
  expect(cosmEval('{ a: 1, b: 2 }.reject(->(key, value) { value > 1 })')).toEqual({ a: 1 });
  expect(cosmEval('{ a: 1, b: 2 }.take(1)')).toEqual({ a: 1 });
  expect(cosmEval('{ a: 1, b: 2 }.reduce("", ->(acc, key, value) { acc + key + value.to_s() })')).toBe("a1b2");
  expect(cosmEval("let increment = ->(value) { value + 1 }; [1, 2, 3].map(increment)")).toEqual([2, 3, 4]);
  expect(cosmEval("let gtOne = ->(key, value) { value > 1 }; { a: 1, b: 2 }.select(gtOne)")).toEqual({ b: 2 });
});

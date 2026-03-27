import { expect, test } from "bun:test";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";
import { CosmProcessValue } from "../src/values/CosmProcessValue";
import { cosmEval } from "./support/cosm_eval";

test("receiver-side methods() reflects inherited visible methods consistently", () => {
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
});

test("Process.exit can be hooked and validates codes", () => {
  let exitedWith: number | undefined;
  try {
    CosmProcessValue.installRuntimeHooks({
      exit: (code?: number) => {
        exitedWith = code;
        throw new Error(`EXIT:${code ?? 0}`);
      },
    });

    expect(() => cosmEval("Process.exit(3)")).toThrow("EXIT:3");
    expect(exitedWith).toBe(3);
    expect(() => cosmEval('Process.exit("nope")')).toThrow("Type error: exit expects a numeric code");
    expect(() => cosmEval("Process.exit(1.5)")).toThrow("Type error: exit expects an integer code");
  } finally {
    CosmProcessValue.installRuntimeHooks({});
  }
});

test("Kernel.eval and Kernel.tryEval delegate to the default explicit session", () => {
  const sharedName = `shared_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  expect(cosmEval(`Kernel.eval("let ${sharedName} = 41"); Kernel.eval("${sharedName} + 1")`)).toBe(42);
  expect(cosmEval(`Kernel.eval("let ${sharedName} = 1"); Kernel.eval("${sharedName} + 2")`)).toBe(3);
  expect(cosmEval('Kernel.tryEval("1 + 2").ok')).toBe(true);
  expect(cosmEval('Kernel.tryEval("1 + 2").inspect')).toBe("3");
  expect(cosmEval('Kernel.tryEval("let repeated = 1\\nlet repeated = 2\\nrepeated").ok')).toBe(true);
  expect(cosmEval('Kernel.tryEval("let repeated = 1\\nlet repeated = 2\\nrepeated").inspect')).toBe("2");
  expect(cosmEval("Session.default().name")).toBe("default");
  expect(cosmEval("Session.default().history().length >= 4")).toBe(true);
  expect(cosmEval('Kernel.tryEval("let = 1").ok')).toBe(false);
  expect(cosmEval('Kernel.tryEval("let = 1").error.message.length > 0')).toBe(true);
  expect(cosmEval("Kernel.resetSession()")).toBe(true);
  expect(cosmEval(`Kernel.tryEval("${sharedName}").ok`)).toBe(false);
});

test("structured errors expose Cosm backtraces instead of TypeScript stacks", () => {
  const error = cosmEval('Kernel.tryEval("Prompt.complete").error') as { message: string; backtrace: string[] };
  expect(error.message).toContain("Property error");
  expect(error.backtrace.length).toBeGreaterThan(0);
  expect(error.backtrace[0]).toContain("access Prompt.complete");
  expect(error.backtrace.some((frame) => frame.includes("src/runtime/"))).toBe(false);
  expect(error.backtrace.some((frame) => frame.includes("src/cosm.ts"))).toBe(false);
});

test("missing-method fallback supports explicit send and implicit self calls", () => {
  expect(cosmEval(`
    class Echo
      def does_not_understand(message, args)
        message.name + ":" + args.length
      end
    end
    Echo.new().unknown(1, 2)
  `)).toBe("unknown:2");

  expect(cosmEval(`
    class Builder
      def does_not_understand(message, args)
        message.name + ":" + args.length
      end
      def render()
        wrapper("ok")
      end
    end
    Builder.new().render()
  `)).toBe("wrapper:1");

  expect(() => cosmEval("class Plain end\nPlain.new.unknown()")).toThrow("Property error");
});

test("Process.env can read host environment strings", () => {
  const previous = process.env.COSM_TEST_TEMP;
  process.env.COSM_TEST_TEMP = "present";
  try {
    expect(cosmEval('Process.env("COSM_TEST_TEMP")')).toBe("present");
    expect(cosmEval('Process.env("COSM_TEST_MISSING")')).toBe(false);
  } finally {
    if (previous === undefined) {
      delete process.env.COSM_TEST_TEMP;
    } else {
      process.env.COSM_TEST_TEMP = previous;
    }
  }
});

test("symbols are interned runtime values", () => {
  expect(cosmEval(":status.class.name")).toBe("Symbol");
  expect(cosmEval(":status.name")).toBe("status");
  expect(cosmEval(":status == :status")).toBe(true);
  expect(cosmEval(":left != :right")).toBe(true);
  expect(cosmEval('Symbol.intern("status").class.name')).toBe("Symbol");
  expect(cosmEval('Symbol.intern("status").name')).toBe("status");
  expect(cosmEval('Symbol.intern("status") == Symbol.intern("status")')).toBe(true);
  expect(cosmEval(':status == Symbol.intern("status")')).toBe(true);
  expect(cosmEval('Symbol.intern("left") != Symbol.intern("right")')).toBe(true);
  expect(cosmEval("1.send(:plus, 2)")).toBe(3);
  expect(cosmEval('"co".send("plus", "sm")')).toBe("cosm");
  expect(cosmEval('"sym=#{:ok}"')).toBe("sym=:ok");
});

test("values expose their class through access notation", () => {
  expect(cosmEval("(1 + 2).class.name")).toBe("Number");
  expect(cosmEval("true.class.name")).toBe("Boolean");
});

test("formatted output uses Cosm-oriented class names", () => {
  const classValue = Cosm.Interpreter.eval("Class");
  const classesValue = Cosm.Interpreter.eval("classes");
  expect(ValueAdapter.format(classValue)).toBe("Class");
  expect(ValueAdapter.format(classesValue)).toContain("Class: Class");
  expect(ValueAdapter.format(Cosm.Interpreter.eval('HttpResponse.text("ok", 201)'))).toBe('#<HttpResponse 201 "ok">');
});

import { expect, test } from "bun:test";
import Cosm from '../src/cosm';
import { ValueAdapter } from "../src/ValueAdapter";
import { CosmProcessValue } from "../src/values/CosmProcessValue";

process.env.COSM_AI_AUTO_DISCOVER_MODEL ??= "0";

const cosmEval = (input: string) => {
  const cosmValue = Cosm.Interpreter.eval(input);
  return ValueAdapter.cosmToJS(cosmValue);
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

test("member access can inspect the class repository", () => {
  expect(cosmEval("classes.Number.name")).toBe("Number");
  expect(cosmEval("classes.Boolean.superclass.name")).toBe("Object");
  expect(cosmEval("classes.Class.name")).toBe("Class");
  expect(cosmEval("classes.Kernel.name")).toBe("Kernel");
  expect(cosmEval("classes.Process.name")).toBe("Process");
  expect(cosmEval("classes.Time.name")).toBe("Time");
  expect(cosmEval("classes.Random.name")).toBe("Random");
  expect(cosmEval("classes.Mirror.name")).toBe("Mirror");
  expect(cosmEval("classes.Method.name")).toBe("Method");
  expect(cosmEval("classes.Symbol.name")).toBe("Symbol");
  expect(cosmEval("classes.Namespace.name")).toBe("Namespace");
  expect(cosmEval("classes.Module.name")).toBe("Module");
  expect(cosmEval("classes.Http.name")).toBe("Http");
  expect(cosmEval("classes.HttpRequest.name")).toBe("HttpRequest");
  expect(cosmEval("classes.HttpResponse.name")).toBe("HttpResponse");
  expect(cosmEval("classes.HttpServer.name")).toBe("HttpServer");
  expect(cosmEval("classes.HttpRouter.name")).toBe("HttpRouter");
  expect(cosmEval("classes.Number.class.name")).toBe("Number class");
  expect(cosmEval("classes.Object.methods.send.name")).toBe("send");
  expect(cosmEval("classes.Object.methods.method.name")).toBe("method");
  expect(cosmEval("Object.new().methods()")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "send" }]));
  expect(cosmEval("Object.methods()")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "send" }, { kind: "symbol", name: "new" }]));
  expect(cosmEval("Kernel.methods()")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "assert" }, { kind: "symbol", name: "dispatch" }]));
  expect(cosmEval("classes.Class.methods.new.name")).toBe("new");
  expect(cosmEval("classes.Class.methods.classMethod.name")).toBe("classMethod");
  expect(cosmEval("classes.Function.methods.call.name")).toBe("call");
  expect(cosmEval("classes.Method.methods.call.name")).toBe("call");
  expect(cosmEval("classes.Symbol.methods.eq.name")).toBe("eq");
  expect(cosmEval("classes.Symbol.classMethods.intern.name")).toBe("intern");
  expect(cosmEval("classes.Namespace.methods.keys.name")).toBe("keys");
  expect(cosmEval("classes.Module.methods.get.name")).toBe("get");
  expect(cosmEval("classes.Kernel.methods.assert.name")).toBe("assert");
  expect(cosmEval("classes.Process.methods.cwd.name")).toBe("cwd");
  expect(cosmEval("classes.Process.methods.argv.name")).toBe("argv");
  expect(cosmEval("classes.Process.methods.pid.name")).toBe("pid");
  expect(cosmEval("classes.Process.methods.exit.name")).toBe("exit");
  expect(cosmEval("classes.Time.methods.now.name")).toBe("now");
  expect(cosmEval("classes.Time.methods.isoNow.name")).toBe("isoNow");
  expect(cosmEval("classes.Time.methods.iso.name")).toBe("iso");
  expect(cosmEval("classes.Random.methods.float.name")).toBe("float");
  expect(cosmEval("classes.Random.methods.int.name")).toBe("int");
  expect(cosmEval("classes.Process.methods.env.name")).toBe("env");
  expect(cosmEval("classes.Http.methods.serve.name")).toBe("serve");
  expect(cosmEval("classes.HttpRequest.methods.bodyText.name")).toBe("bodyText");
  expect(cosmEval("classes.HttpResponse.classMethods.ok.name")).toBe("ok");
  expect(cosmEval("classes.HttpResponse.classMethods.html.name")).toBe("html");
  expect(cosmEval("classes.HttpResponse.classMethods.text.name")).toBe("text");
  expect(cosmEval("classes.HttpResponse.classMethods.json.name")).toBe("json");
  expect(cosmEval("classes.HttpServer.methods.stop.name")).toBe("stop");
  expect(cosmEval("classes.HttpRouter.methods.get.name")).toBe("get");
  expect(cosmEval("classes.HttpRouter.methods.draw.name")).toBe("draw");
  expect(cosmEval("classes.Mirror.classMethods.reflect.name")).toBe("reflect");
  expect(cosmEval("cosm.classes.Number.name")).toBe("Number");
  expect(cosmEval("Number.name")).toBe("Number");
});

test("Kernel and cosm expose ambient reflective services", () => {
  expect(cosmEval("Kernel.assert(true)")).toBe(true);
  expect(cosmEval("cosm.Kernel.assert(true)")).toBe(true);
  expect(cosmEval("Kernel.method(:print).name")).toBe("print");
  expect(cosmEval("Kernel.method(:puts).name")).toBe("puts");
  expect(cosmEval("Kernel.method(:warn).name")).toBe("warn");
  expect(cosmEval("Kernel.method(:test).name")).toBe("test");
  expect(cosmEval("Kernel.method(:describe).name")).toBe("describe");
  expect(cosmEval("Kernel.method(:expectEqual).name")).toBe("expectEqual");
  expect(cosmEval("Kernel.method(:resetTests).name")).toBe("resetTests");
  expect(cosmEval("Kernel.method(:testSummary).name")).toBe("testSummary");
  expect(cosmEval("cosm.test.class.name")).toBe("Module");
  expect(cosmEval('cosm.test.name')).toBe("cosm/test");
  expect(cosmEval("cosm.modules.test.class.name")).toBe("Module");
  expect(cosmEval("cosm.test.has(:test)")).toBe(true);
  expect(cosmEval("cosm.test.has(:describe)")).toBe(true);
  expect(cosmEval("cosm.test.has(:expectEqual)")).toBe(true);
  expect(cosmEval("Process.class.name")).toBe("Process");
  expect(cosmEval("cosm.Process.class.name")).toBe("Process");
  expect(cosmEval("Mirror.class.name")).toBe("Mirror class");
  expect(cosmEval("HttpRouter.class.name")).toBe("HttpRouter class");
  expect(cosmEval("Time.class.name")).toBe("Time");
  expect(cosmEval("Random.class.name")).toBe("Random");
  expect(cosmEval("Data.class.name")).toBe("Module");
  expect(cosmEval("Data.Model.name")).toBe("DataModel");
  expect(cosmEval("http.class.name")).toBe("Http");
  expect(cosmEval("cosm.http.class.name")).toBe("Http");
});

test("modules, views, and runtime roots expose predictable reflective surfaces", () => {
  expect(cosmEval('require("cosm/test"); cosm.test.class.name')).toBe("Module");
  expect(cosmEval('require("cosm/test")')).toMatchObject({ kind: "module", name: "cosm/test" });
  expect(cosmEval('require("cosm/data")')).toMatchObject({ kind: "module", name: "cosm/data" });
  expect(cosmEval('require("cosm/ai.cosm")')).toMatchObject({ kind: "module", name: "cosm/ai.cosm" });
  expect(cosmEval('require("app/examples.cosm"); examples.class.name')).toBe("Module");
  expect(cosmEval('require("app/examples.cosm"); examples.receiverReflection().code')).toBe("Object.new().methods()");
  expect(cosmEval('require("app/examples.cosm"); examples.dispatchHelper().code')).toBe("Kernel.dispatch(1, :plus, 2)");
  expect(cosmEval('require("app/examples.cosm"); examples.catalog().length')).toBe(16);
  expect(cosmEval('require("app/app.cosm"); app.class.name')).toBe("Module");
  expect(cosmEval('require("app/views/index.cosm"); views.class.name')).toBe("Module");
  expect(cosmEval('require("app/app.cosm"); app.App.class.name')).toBe("App class");
  expect(cosmEval('require("app/app.cosm"); app.App.build().class.name')).toBe("App");
  expect(cosmEval('require("cosm/test"); test.class.name')).toBe("Function");
  expect(cosmEval('require("cosm/test"); describe.class.name')).toBe("Function");
  expect(cosmEval('require("cosm/test"); expectEqual.class.name')).toBe("Function");
  expect(cosmEval("cosm.length >= 3")).toBe(true);
  expect(cosmEval("cosm.has(:version)")).toBe(true);
  expect(cosmEval("cosm.keys().length >= 3")).toBe(true);
  expect(cosmEval('cosm.get(:version)')).toBe("0.3.12.2");
  expect(cosmEval('classes.get(:Kernel).name')).toBe("Kernel");
  expect(cosmEval("cosm.values().length >= cosm.length")).toBe(true);
  expect(cosmEval("Kernel.class.name")).toBe("Kernel");
  expect(cosmEval("classes.class.name")).toBe("Namespace");
  expect(cosmEval("cosm.class.name")).toBe("Namespace");
  expect(cosmEval("cosm.version")).toBe("0.3.12.2");
  expect(cosmEval("cosm.Data.class.name")).toBe("Module");
  expect(cosmEval("cosm.modules.data.class.name")).toBe("Module");
  expect(cosmEval("cosm.modules.ai.class.name")).toBe("Module");
  expect(cosmEval("Process.argv().length >= 1")).toBe(true);
});

test("Kernel, Process, Time, and Random expose tie-your-shoes runtime helpers", () => {
  expect(cosmEval('classes.Kernel.methods.assert.call(true, "ok")')).toBe(true);
  expect(cosmEval("Kernel.send(:assert, true)")).toBe(true);
  expect(cosmEval("Kernel.dispatch(1, :plus, 2)")).toBe(3);
  expect(cosmEval("Kernel.uuid().length >= 32")).toBe(true);
  expect(cosmEval('Kernel.trace("value", 41)')).toBe(41);
  expect(cosmEval('Kernel.inspect(Symbol.intern("ok"))')).toBe(":ok");
  expect(cosmEval('Symbol.intern("ok").inspect()')).toBe(":ok");
  expect(cosmEval("Kernel.inspect(Kernel)")).toBe("#<Kernel>");
  expect(cosmEval("Kernel.inspect(Kernel) == Kernel.inspect()")).toBe(true);
  expect(cosmEval('Kernel.escapeHtml("<tag> & \'quote\'")')).toBe("&lt;tag&gt; &amp; &#39;quote&#39;");
  expect(cosmEval('Kernel.expectEqual([1, 2], [1, 2])')).toBe(true);
  expect(cosmEval("Time.now() > 0")).toBe(true);
  expect(cosmEval('Time.iso(0)')).toBe("1970-01-01T00:00:00.000Z");
  expect(cosmEval("Time.isoNow().length >= 20")).toBe(true);
  expect(cosmEval('Time.fromIso("1970-01-01T00:00:00.000Z")')).toBe(0);
  expect(cosmEval("Process.cwd().length > 0")).toBe(true);
  expect(cosmEval("Process.pid() > 0")).toBe(true);
  expect(cosmEval("Process.platform().length > 0")).toBe(true);
  expect(cosmEval("Process.arch().length > 0")).toBe(true);
  expect(cosmEval("Kernel.sleep(0)")).toBe(0);
  expect(cosmEval("Random.float() >= 0 && Random.float() < 1")).toBe(true);
  expect(cosmEval("Random.int(5) >= 0 && Random.int(5) < 5")).toBe(true);
  expect(cosmEval('Random.choice(["a", "b", "c"]).class.name')).toBe("String");
  expect(() => cosmEval("Kernel.now()")).toThrow("Property error: object of class Kernel has no property 'now'");
  expect(() => cosmEval("Kernel.random()")).toThrow("Property error: object of class Kernel has no property 'random'");
  expect(() => cosmEval("Kernel.cwd")).toThrow("Property error: object of class Kernel has no property 'cwd'");
  expect(() => cosmEval('Kernel.env("HOME")')).toThrow("Property error: object of class Kernel has no property 'env'");
});

test("reflective inspect and method surfaces remain available on representative runtime objects", () => {
  expect(cosmEval('Kernel.inspect(cosm.test)')).toContain('#<Module "cosm/test"');
  expect(cosmEval('require("cosm/test"); Kernel.inspect(cosm.test)')).toContain('#<Module "cosm/test"');
  expect(cosmEval('Kernel.inspect(HttpResponse.text("ok", 201))')).toBe('#<HttpResponse 201 "ok">');
  expect(cosmEval('Kernel.inspect(HttpRouter.new())')).toBe('#<HttpRouter routes: 0>');
  expect(cosmEval('Kernel.inspect(Mirror.reflect([1, 2]))')).toBe('#<Mirror [1, 2]>');
  expect(cosmEval('Kernel.dispatch(1, Symbol.intern("plus"), 2)')).toBe(3);
  expect(cosmEval("Kernel.method(:assert).class.name")).toBe("Method");
  expect(cosmEval("Kernel.method(:assert).name")).toBe("assert");
  expect(cosmEval("Kernel.method(:assert)(true)")).toBe(true);
  expect(cosmEval("Kernel.method(:assert).call(true)")).toBe(true);
  expect(cosmEval("classes.Kernel.methods.assert.name")).toBe("assert");
  expect(cosmEval('classes.Kernel.methods.assert.call(true, "ok")')).toBe(true);
});

test("Error, Schema, Prompt, Ai, and Mirror remain wired into the reflective runtime", () => {
  expect(cosmEval("Error.class.name")).toBe("Error class");
  expect(cosmEval("Schema.class.name")).toBe("Schema class");
  expect(cosmEval("Prompt.class.name")).toBe("Prompt class");
  expect(cosmEval("ai.class.name")).toBe("Ai");
  expect(cosmEval("cosm.ai.class.name")).toBe("Ai");
  expect(cosmEval('Prompt.text("hi").source')).toBe("hi");
  expect(cosmEval('Error.new("boom").message')).toBe("boom");
  expect(cosmEval('Error.new("boom").inspect()')).toBe('#<Error "boom">');
  expect(cosmEval('Schema.string().describe()')).toBe("Schema.string()");
  expect(cosmEval('Schema.string().inspect()')).toBe("Schema.string()");
  expect(cosmEval('Schema.number().validate(42)')).toBe(true);
  expect(cosmEval('Schema.boolean().validate(true)')).toBe(true);
  expect(cosmEval('Schema.enum("a", "b").validate("a")')).toBe(true);
  expect(cosmEval('Schema.object({ answer: Schema.number() }).validate({ answer: 42 })')).toBe(true);
  expect(cosmEval('Kernel.tryValidate(42, Schema.number()).ok')).toBe(true);
  expect(cosmEval('Kernel.tryValidate(42, Schema.number()).value')).toBe(42);
  expect(cosmEval('Kernel.tryValidate({ answer: "hi" }, Data.model("Reason", { answer: Data.string() })).ok')).toBe(true);
  expect(cosmEval('Kernel.tryValidate(1, Schema.string()).ok')).toBe(false);
  expect(cosmEval('Kernel.try(->() { 1 + 2 }).ok')).toBe(true);
  expect(cosmEval('Kernel.try(->() { Kernel.raise("boom") }).ok')).toBe(false);
  expect(cosmEval('Kernel.try(->() { Kernel.raise("boom") }).error.message')).toBe("boom");
  expect(cosmEval('Kernel.try(->() { Schema.string().validate(1) }).error.message')).toContain("Schema validation failed");
  expect(cosmEval('Kernel.try(->() { Schema.string().validate(1) }).error.details.path')).toBe("$");
  expect(cosmEval('Kernel.try(->() { cosm.ai.complete("hi") }).error.message')).toContain("AI backend is not configured");
  expect(cosmEval('Kernel.try(->() { cosm.ai.cast("hi", Schema.string()) }).error.message')).toContain("AI backend is not configured");
  expect(cosmEval('Kernel.try(->() { "cats" ~= "felines" }).error.message')).toContain("AI backend is not configured");
  expect(cosmEval('Data.model("Reason", { answer: Data.string() }).inspect()')).toBe('#<Data::Model "Reason">');
  expect(cosmEval('Data.model("Reason", { answer: Data.string() }).schema().inspect()')).toBe('Schema.object({ answer: Schema.string() })');
  expect(cosmEval('Kernel.try(->() { Data.model("Reason", { answer: Data.string() }).validate({ answer: 1 }) }).error.details.path')).toBe("$.answer");
  expect(cosmEval("Mirror.reflect({ answer: 42 }).targetClass.name")).toBe("Hash");
  expect(cosmEval('Mirror.reflect({ answer: 42 }).inspect()')).toBe('#<Mirror { answer: 42 }>');
  expect(cosmEval("Mirror.reflect(Kernel).has(:assert)")).toBe(true);
  expect(cosmEval("Mirror.reflect(Kernel).get(:assert).name")).toBe("assert");
  expect(cosmEval("Mirror.reflect(Kernel).methods()")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "assert" }, { kind: "symbol", name: "dispatch" }]));
  expect(cosmEval("Mirror.reflect(Object.new()).methods()")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "send" }]));
  expect(cosmEval('Mirror.reflect(cosm.test).targetClass.name')).toBe("Module");
  expect(cosmEval('Mirror.reflect(HttpRouter.new()).inspect()')).toBe('#<Mirror #<HttpRouter routes: 0>>');
  expect(cosmEval("class Tool do end; cosm.classes.Tool.name")).toBe("Tool");
});

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

test("session environments can retain bindings across evaluations", () => {
  const env = Cosm.Interpreter.createEnv();
  expect(ValueAdapter.cosmToJS(Cosm.Interpreter.evalInEnv("let a = 4", env))).toBe(4);
  expect(ValueAdapter.cosmToJS(Cosm.Interpreter.evalInEnv('"a=#{a}"', env))).toBe("a=4");
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
  expect(cosmEval("let id = ->(x) { x }; id.call(42)")).toBe(42);
  expect(cosmEval('def greet(name) "hi " + name end; greet("cosm")')).toBe("hi cosm");
  expect(cosmEval('def greet(name = "cosm") "hi " + name end; greet()')).toBe("hi cosm");
  expect(cosmEval('def greet(name = "cosm") "hi " + name end; greet("runtime")')).toBe("hi runtime");
  expect(cosmEval('let greet = ->(name) { "hello " + name }; greet("cosm")')).toBe("hello cosm");
  expect(cosmEval('let greet = ->(name = "cosm") { "hello " + name }; greet()')).toBe("hello cosm");
  expect(cosmEval('let greet = ->(name = "runtime") { "hello " + name }; greet("cosm")')).toBe("hello cosm");
  expect(cosmEval("let pair = ->(a, b) { a + b }; pair(20, 22)")).toBe(42);
  expect(cosmEval('let outer = "co"; let join = ->(rest) { outer + rest }; join("sm")')).toBe("cosm");
  expect(cosmEval('let fortyTwo = ->() { 42 }; fortyTwo()')).toBe(42);
  expect(cosmEval('def named(name) do "hi " + name end; named("cosm")')).toBe("hi cosm");
  expect(cosmEval('let prefix = "co"; def joinDef(rest) do prefix + rest end; joinDef("sm")')).toBe("cosm");
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
  expect(cosmEval('class Counter do def init(value) do true end; def current() do value end end; Counter.new(4).current()')).toBe(4);
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
  expect(cosmEval("class Pair do def init(left, right) do true end end; Pair.slots.length")).toBe(2);
  expect(cosmEval("class Pair do def init(left, right) do true end; def sum() do @left + @right end end; let pair = Pair.new(1, 2); pair.sum()")).toBe(3);
  expect(cosmEval('class Greeter do def greet(name) do "hello " + name end end; Greeter.methods.greet.name')).toBe("greet");
  expect(cosmEval('class Greeter def greet(name) "hello " + name end end; Greeter.methods.greet.name')).toBe("greet");
  expect(cosmEval('class Greeter do def self.label() do self.name + "!" end end; Greeter.classMethods.label.name')).toBe("label");
  expect(cosmEval('class Greeter do def self.label() do self.name + "!" end end; Greeter.classMethod(:label).name')).toBe("label");
  expect(cosmEval('class Greeter do def self.label() do self.name + "!" end end; Greeter.classMethod(:label)()')).toBe("Greeter!");
  expect(cosmEval('class Greeter do def self.label() do self.name + "!" end end; Greeter.classMethod(:label).call()')).toBe("Greeter!");
  expect(cosmEval('class Greeter do def kind() do self.class.name end end; let g = Greeter.new(); g.kind()')).toBe("Greeter");
  expect(cosmEval('class Greeter do def self.label() do self.name + "!" end end; Greeter.label()')).toBe("Greeter!");
  expect(cosmEval('class Greeter\n  class << self\n    def label()\n      self.name + "!"\n    end\n  end\nend\nGreeter.label()')).toBe("Greeter!");
  expect(cosmEval('class Greeter do def self.kind() do self.class.name end end; Greeter.kind()')).toBe("Greeter class");
  expect(cosmEval('class Base do def self.label() do "base" end end; class Child < Base do end; Child.label()')).toBe("base");
  expect(cosmEval('class Base do def self.label() do "base" end end; class Child < Base do end; Child.metaclass.superclass.name')).toBe("Base class");
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
  expect(() => cosmEval("Symbol.intern(1)")).toThrow("Type error: Symbol.intern expects a string argument");
  expect(() => cosmEval("1.send(1, 2)")).toThrow("Type error: send expects a string or symbol message, got number");
  expect(() => cosmEval("Kernel.method(:missing)")).toThrow("Property error: object of class Kernel has no property 'missing'");
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
  expect(() => cosmEval("def greet(name = \"cosm\", suffix) do name + suffix end; greet()")).toThrow("Arity error: function expects 2 arguments, got 0");
  expect(() => cosmEval("class Thing do def init(value, value) do true end end")).toThrow("Name error: duplicate slot 'value' in class 'Thing'");
  expect(() => cosmEval("@value")).toThrow("Name error: ivar access '@value' requires self");
  expect(() => cosmEval("class Thing do def init(value) do true end; def missing() do @other end end; Thing.new(1).missing()")).toThrow("Property error: object of class Thing has no ivar '@other'");
  expect(() => cosmEval("let class = 1")).toThrow("Parse error:");
  expect(() => cosmEval("let self = 1")).toThrow("Parse error:");
});

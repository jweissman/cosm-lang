import { expect, test } from "bun:test";
import { cosmEval, cosmEvalWithoutAi } from "./support/cosm_eval";

test("member access can inspect the class repository", () => {
  expect(cosmEval("classes.BasicObject.name")).toBe("BasicObject");
  expect(cosmEval("classes.Object.superclass.name")).toBe("BasicObject");
  expect(cosmEval("classes.Module.superclass.name")).toBe("Object");
  expect(cosmEval("classes.Class.superclass.name")).toBe("Module");
  expect(cosmEval("classes.Number.name")).toBe("Number");
  expect(cosmEval("classes.Boolean.superclass.name")).toBe("Object");
  expect(cosmEval("classes.Nihil.superclass.name")).toBe("Object");
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
  expect(cosmEval("classes.Object.method(:send).name")).toBe("send");
  expect(cosmEval("classes.Object.method(:method).name")).toBe("method");
  expect(cosmEval("classes.Object.methods")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "send" }, { kind: "symbol", name: "new" }]));
  expect(cosmEval("Object.new().methods()")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "send" }]));
  expect(cosmEval("Object.methods()")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "send" }, { kind: "symbol", name: "new" }]));
  expect(cosmEval("Kernel.methods()")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "assert" }, { kind: "symbol", name: "dispatch" }]));
  expect(cosmEval("classes.Class.method(:new).name")).toBe("new");
  expect(cosmEval("classes.Class.method(:classMethod).name")).toBe("classMethod");
  expect(cosmEval("classes.Function.method(:call).name")).toBe("call");
  expect(cosmEval("classes.Method.method(:call).name")).toBe("call");
  expect(cosmEval("classes.Symbol.method(:eq).name")).toBe("eq");
  expect(cosmEval("classes.Symbol.classMethod(:intern).name")).toBe("intern");
  expect(cosmEval("classes.Namespace.method(:keys).name")).toBe("keys");
  expect(cosmEval("classes.Module.method(:get).name")).toBe("get");
  expect(cosmEval("BasicObject.class.name")).toBe("BasicObject class");
  expect(cosmEval("classes.Kernel.method(:assert).name")).toBe("assert");
  expect(cosmEval("classes.Process.method(:cwd).name")).toBe("cwd");
  expect(cosmEval("classes.Process.method(:argv).name")).toBe("argv");
  expect(cosmEval("classes.Process.method(:pid).name")).toBe("pid");
  expect(cosmEval("classes.Process.method(:exit).name")).toBe("exit");
  expect(cosmEval("classes.Time.method(:now).name")).toBe("now");
  expect(cosmEval("classes.Time.method(:isoNow).name")).toBe("isoNow");
  expect(cosmEval("classes.Time.method(:iso).name")).toBe("iso");
  expect(cosmEval("classes.Random.method(:float).name")).toBe("float");
  expect(cosmEval("classes.Random.method(:int).name")).toBe("int");
  expect(cosmEval("classes.Process.method(:env).name")).toBe("env");
  expect(cosmEval("classes.Http.method(:serve).name")).toBe("serve");
  expect(cosmEval("classes.Http.method(:request).name")).toBe("request");
  expect(cosmEval("classes.HttpRequest.method(:bodyText).name")).toBe("bodyText");
  expect(cosmEval("classes.HttpResponse.classMethod(:ok).name")).toBe("ok");
  expect(cosmEval("classes.HttpResponse.classMethod(:html).name")).toBe("html");
  expect(cosmEval("classes.HttpResponse.classMethod(:text).name")).toBe("text");
  expect(cosmEval("classes.HttpResponse.classMethod(:json).name")).toBe("json");
  expect(cosmEval("classes.HttpServer.method(:stop).name")).toBe("stop");
  expect(cosmEval("HttpRouter.new().method(:get).name")).toBe("get");
  expect(cosmEval("HttpRouter.new().method(:draw).name")).toBe("draw");
  expect(cosmEval("classes.Mirror.classMethod(:reflect).name")).toBe("reflect");
  expect(cosmEval("Number.name")).toBe("Number");
  expect(cosmEval("Nihil.name")).toBe("Nihil");
});

test("Kernel and Cosm expose reflective services", () => {
  expect(cosmEval("Kernel.assert(true)")).toBe(true);
  expect(cosmEval("Cosm::Kernel.assert(true)")).toBe(true);
  expect(cosmEval("Kernel.method(:print).name")).toBe("print");
  expect(cosmEval("Kernel.method(:puts).name")).toBe("puts");
  expect(cosmEval("Kernel.method(:warn).name")).toBe("warn");
  expect(cosmEval("Kernel.method(:test).name")).toBe("test");
  expect(cosmEval("Kernel.method(:describe).name")).toBe("describe");
  expect(cosmEval("Kernel.method(:hmacSha256).name")).toBe("hmacSha256");
  expect(cosmEval("Kernel.method(:expectEqual).name")).toBe("expectEqual");
  expect(cosmEval("Kernel.method(:resetTests).name")).toBe("resetTests");
  expect(cosmEval("Kernel.method(:testSummary).name")).toBe("testSummary");
  expect(cosmEval('require "cosm/test"; Cosm::Test.class.name')).toBe("Module");
  expect(cosmEval('require "cosm/test"; Cosm::Test.name')).toBe("cosm/test");
  expect(cosmEval('require "cosm/test"; Cosm::Test.has(:test)')).toBe(true);
  expect(cosmEval('require "cosm/test"; Cosm::Test.has(:describe)')).toBe(true);
  expect(cosmEval('require "cosm/test"; Cosm::Test.has(:expectEqual)')).toBe(true);
  expect(cosmEval("Process.class.name")).toBe("Process");
  expect(cosmEval("Cosm::Process.class.name")).toBe("Process");
  expect(cosmEval("Mirror.class.name")).toBe("Mirror class");
  expect(cosmEval("HttpRouter.class.name")).toBe("HttpRouter class");
  expect(cosmEval("Time.class.name")).toBe("Time");
  expect(cosmEval("Random.class.name")).toBe("Random");
  expect(cosmEval("Data.class.name")).toBe("Module");
  expect(cosmEval("Data.Model.name")).toBe("DataModel");
  expect(cosmEval("http.class.name")).toBe("Http");
  expect(cosmEval("Cosm::Http.class.name")).toBe("Http");
});

test("modules, views, and runtime roots expose predictable reflective surfaces", () => {
  expect(cosmEval('require "cosm/test"; Cosm::Test.class.name')).toBe("Module");
  expect(cosmEval('require "cosm/test"')).toMatchObject({ kind: "module", name: "cosm/test" });
  expect(cosmEval('require "cosm/data"')).toMatchObject({ kind: "module", name: "cosm/data" });
  expect(cosmEval('require "cosm/ai"')).toMatchObject({ kind: "module", name: "cosm/ai.cosm" });
  expect(cosmEval('require "lib/app/examples"; App::Examples.class.name')).toBe("Module");
  expect(cosmEval('require "lib/app/examples"; App::Examples.receiver_reflection().code')).toBe("Object.new().methods().length > 0\n");
  expect(cosmEval('require "lib/app/examples"; App::Examples.dispatch_helper().code')).toBe("Kernel.dispatch(1, :plus, 2)\n");
  expect(cosmEval('require "lib/app/examples"; App::Examples.catalog().length')).toBe(16);
  expect(cosmEval('require "lib/app/app"; App.class.name')).toBe("Module");
  expect(cosmEval('require "lib/app/views/index"; App::Views.class.name')).toBe("Module");
  expect(cosmEval('require "lib/app/app"; App::App.class.name')).toBe("App class");
  expect(cosmEval('require "lib/app/app"; App::App.build().class.name')).toBe("App");
  expect(cosmEval('require "cosm/test"; Cosm::Test.get(:test).class.name')).toBe("Function");
  expect(cosmEval('require "cosm/test"; Cosm::Test.get(:describe).class.name')).toBe("Function");
  expect(cosmEval('require "cosm/test"; Cosm::Test.get(:expectEqual).class.name')).toBe("Function");
  expect(cosmEval("Cosm.length >= 3")).toBe(true);
  expect(cosmEval("Cosm.has(:version)")).toBe(true);
  expect(cosmEval("Cosm.keys().length >= 3")).toBe(true);
  expect(cosmEval('Cosm.version')).toBe("0.3.13.39");
  expect(cosmEval('classes.get(:Kernel).name')).toBe("Kernel");
  expect(cosmEval("Cosm.values().length >= Cosm.length")).toBe(true);
  expect(cosmEval("Kernel.class.name")).toBe("Kernel");
  expect(cosmEval("classes.class.name")).toBe("Namespace");
  expect(cosmEval("Cosm.class.name")).toBe("Module");
  expect(cosmEval("Cosm.version")).toBe("0.3.13.39");
  expect(cosmEval("Cosm::Data.class.name")).toBe("Module");
  expect(cosmEval('require "cosm/ai"; Cosm::AI.class.name')).toBe("Module");
  expect(cosmEval("Process.argv().length >= 1")).toBe(true);
}, 15000);

test("require defines constant modules directly", () => {
  expect(cosmEval('require "lib/support/chat"; Support::Chat.class.name')).toBe("Module");
  expect(cosmEval('require "lib/support/chat"; Support::Chat.help().length > 10')).toBe(true);
});

test("Cosm::Spec is the canonical spec harness", () => {
  expect(cosmEval('require "cosm/spec.cosm"; Cosm::Spec.assert(true)')).toBe(true);
  expect(cosmEval('require "cosm/spec.cosm"; Cosm::Spec.refute(false)')).toBe(true);
  expect(cosmEval('require "cosm/spec.cosm"; Cosm::Spec.assert_equal(4, 4)')).toBe(true);
  expect(cosmEval('require "cosm/spec.cosm"; Cosm::Spec.expect(4).to_eql(4)')).toBe(true);
  expect(cosmEval('require "cosm/spec.cosm"; Cosm::Spec.expect(true).to_be_truthy()')).toBe(true);
  expect(cosmEval('require "cosm/spec.cosm"; Cosm::Spec.expect_raises(->() { Kernel.raise("boom", { code: 7 }) }).details.code')).toBe(7);
  expect(cosmEval('require "cosm/spec.cosm"; Cosm::Spec.expect(->() { Kernel.raise("boom", { code: 7 }) }).to_raise("boom").details.code')).toBe(7);
  expect(() => cosmEval('require "cosm/spec.cosm"; Cosm::Spec.expect_raises(->() { 42 })')).toThrow("Expectation failed: expected a raised error");
  expect(() => cosmEval('require "cosm/spec.cosm"; Cosm::Spec.expect(42).to_raise()')).toThrow("Type error: expect(...).to_raise expects a callable value");
});

test("requiring cosm/spec injects implicit spec helpers into ordinary Cosm evaluation", () => {
  expect(cosmEval('Kernel.resetTests(); require "cosm/spec.cosm"; suite("smoke") do it("passes") do expect(2 + 2).to_eql(4) end end; Kernel.testSummary().passed')).toBe(1);
  expect(cosmEval('Kernel.resetTests(); require "cosm/spec.cosm"; suite("compat", ->() { it("passes", ->() { assert(true) }) }); Kernel.testSummary().passed')).toBe(1);
});

test("Kernel, Process, Time, and Random expose tie-your-shoes runtime helpers", () => {
  expect(cosmEval('classes.Kernel.method(:assert).call(true, "ok")')).toBe(true);
  expect(cosmEval("Kernel.send(:assert, true)")).toBe(true);
  expect(cosmEval("Kernel.dispatch(1, :plus, 2)")).toBe(3);
  expect(cosmEval("Kernel.uuid().length >= 32")).toBe(true);
  expect(cosmEval('Kernel.hmacSha256("secret", "payload")')).toBe("b82fcb791acec57859b989b430a826488ce2e479fdf92326bd0a2e8375a42ba4");
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
  expect(cosmEval('require "cosm/test"; Kernel.inspect(Cosm::Test)')).toContain('#<Module "cosm/test"');
  expect(cosmEval('Kernel.inspect(HttpResponse.text("ok", 201))')).toBe('#<HttpResponse 201 "ok">');
  expect(cosmEval('Kernel.inspect(HttpRouter.new())')).toBe('#<HttpRouter routes: 0>');
  expect(cosmEval('Kernel.inspect(Mirror.reflect([1, 2]))')).toBe('#<Mirror [1, 2]>');
  expect(cosmEval('Kernel.dispatch(1, Symbol.intern("plus"), 2)')).toBe(3);
  expect(cosmEval("Kernel.method(:assert).class.name")).toBe("Method");
  expect(cosmEval("Kernel.method(:assert).name")).toBe("assert");
  expect(cosmEval("Kernel.method(:assert)(true)")).toBe(true);
  expect(cosmEval("Kernel.method(:assert).call(true)")).toBe(true);
  expect(cosmEval("classes.Kernel.method(:assert).name")).toBe("assert");
  expect(cosmEval('classes.Kernel.method(:assert).call(true, "ok")')).toBe(true);
});

test("Error, Schema, Prompt, Ai, and Mirror remain wired into the reflective runtime", () => {
  expect(cosmEval("Error.class.name")).toBe("Error class");
  expect(cosmEval("Schema.class.name")).toBe("Schema class");
  expect(cosmEval("Prompt.class.name")).toBe("Prompt class");
  expect(cosmEval("ai.class.name")).toBe("Ai");
  expect(cosmEval('require "cosm/ai"; Cosm::AI.class.name')).toBe("Module");
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
  expect(cosmEvalWithoutAi('Kernel.try(->() { require "cosm/ai"; Cosm::AI.complete("hi") }).error.message')).toContain("AI backend is not configured");
  expect(cosmEvalWithoutAi('Kernel.try(->() { require "cosm/ai"; Cosm::AI.cast("hi", Schema.string()) }).error.message')).toContain("AI backend is not configured");
  expect(cosmEvalWithoutAi('Kernel.try(->() { "cats" ~= "felines" }).error.message')).toContain("AI backend is not configured");
  expect(cosmEval('Data.model("Reason", { answer: Data.string() }).inspect()')).toBe('#<Data::Model "Reason">');
  expect(cosmEval('Data.model("Reason", { answer: Data.string() }).schema().inspect()')).toBe('Schema.object({ answer: Schema.string() })');
  expect(cosmEval('Kernel.try(->() { Data.model("Reason", { answer: Data.string() }).validate({ answer: 1 }) }).error.details.path')).toBe("$.answer");
  expect(cosmEval("Mirror.reflect({ answer: 42 }).targetClass.name")).toBe("Hash");
  expect(cosmEval('Mirror.reflect({ answer: 42 }).inspect()')).toBe('#<Mirror { answer: 42 }>');
  expect(cosmEval("Mirror.reflect(Kernel).has(:assert)")).toBe(true);
  expect(cosmEval("Mirror.reflect(Kernel).get(:assert).name")).toBe("assert");
  expect(cosmEval("Mirror.reflect(Kernel).methods()")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "assert" }, { kind: "symbol", name: "dispatch" }]));
  expect(cosmEval("Mirror.reflect(Object.new()).methods()")).toEqual(expect.arrayContaining([{ kind: "symbol", name: "send" }]));
  expect(cosmEval('require "cosm/test"; Mirror.reflect(Cosm::Test).targetClass.name')).toBe("Module");
  expect(cosmEval('Mirror.reflect(HttpRouter.new()).inspect()')).toBe('#<Mirror #<HttpRouter routes: 0>>');
  expect(cosmEval('Mirror.reflect(http.headers({ accept: "application/json" })).inspect()')).toBe('#<Mirror #<HostObject bun.headers accept: "application/json">>');
  expect(cosmEval('require "cosm/hologram"; Cosm::Hologram.status().mode')).toBe("narrow-writable-boundary");
  expect(cosmEval('require "cosm/hologram"; Cosm::Hologram.status().intended_role')).toBe("js-interop-capability-wrapper");
  expect(cosmEval('require "cosm/hologram"; Cosm::Hologram.status().host_wrapper_kinds')).toEqual(["bun.headers", "json.object"]);
  expect(cosmEval('require "cosm/hologram"; Cosm::Hologram.wrap(Kernel).target_class.name')).toBe("Kernel");
  expect(cosmEval('require "cosm/hologram"; holo = Cosm::Hologram.wrap({ answer: 1 }); holo.set(:answer, 2); holo.get(:answer)')).toBe(2);
  expect(cosmEval('require "cosm/hologram"; headers = http.headers({ accept: "application/json" }); holo = Cosm::Hologram.wrap(headers); holo.set("x-runtime", "cosm"); [holo.get(:accept), holo.get("x-runtime")]')).toEqual(["application/json", "cosm"]);
  expect(cosmEval('Mirror.status().mode')).toBe("readonly-observer");
  expect(cosmEval('Mirror.status().intended_role')).toBe("readonly-view-and-delegation-surface");
  expect(cosmEval('require "cosm/ai"; Cosm::AI.compare("cat", "cat")')).toBe(true);
  expect(cosmEval("class Tool do end; classes.Tool.name")).toBe("Tool");
});

test("module authoring and begin-rescue make module/mixin and errors more explicit", () => {
  expect(cosmEval(`
    module GreetingTools
      def label() = "hi"
    end
    GreetingTools.name
  `)).toBe("GreetingTools");
  expect(cosmEval(`
    module Outer
      module Inner
        def label() = "nested"
      end
    end
    Outer::Inner.label()
  `)).toBe("nested");
  expect(cosmEval(`
    begin
      Kernel.raise("boom", { code: 7 })
    rescue err
      err.details.code
    end
  `)).toBe(7);
  expect(cosmEval(`
    begin
      Schema.string().validate(1)
    rescue err
      err.details.path
    end
  `)).toBe("$");
});

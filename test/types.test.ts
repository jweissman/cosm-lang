import { expect, test } from "bun:test";
import { Construct as Val } from "../src/Construct";
import { manifestClassMethods, manifestMethods } from "../src/runtime/RuntimeManifest";
import { CosmClassValue } from "../src/values/CosmClassValue";
import { CosmFunctionValue } from "../src/values/CosmFunctionValue";
import { CosmKernelValue } from "../src/values/CosmKernelValue";
import { CosmMethodValue } from "../src/values/CosmMethodValue";
import { CosmModuleValue } from "../src/values/CosmModuleValue";
import { CosmNamespaceValue } from "../src/values/CosmNamespaceValue";
import { CosmObjectValue } from "../src/values/CosmObjectValue";
import { CosmProcessValue } from "../src/values/CosmProcessValue";
import { CosmRandomValue } from "../src/values/CosmRandomValue";
import { CosmSymbolValue } from "../src/values/CosmSymbolValue";
import { CosmTimeValue } from "../src/values/CosmTimeValue";
import { CosmValueBase } from "../src/values/CosmValueBase";
import { RuntimeEquality } from "../src/runtime/RuntimeEquality";
import { CosmHttpValue } from "../src/values/CosmHttpValue";
import { CosmHttpRequestValue } from "../src/values/CosmHttpRequestValue";
import { CosmHttpResponseValue } from "../src/values/CosmHttpResponseValue";
import { CosmHttpServerValue } from "../src/values/CosmHttpServerValue";
import { CosmHttpRouterValue } from "../src/values/CosmHttpRouterValue";
import { CosmMirrorValue } from "../src/values/CosmMirrorValue";
import { CosmErrorValue } from "../src/values/CosmErrorValue";
import { CosmSchemaValue } from "../src/values/CosmSchemaValue";
import { CosmPromptValue } from "../src/values/CosmPromptValue";
import { CosmAiValue } from "../src/values/CosmAiValue";
import { CosmSessionValue } from "../src/values/CosmSessionValue";

test("type constructors build expected runtime values", () => {
  expect(Val.number(42)).toMatchObject({ type: "number", value: 42 });
  expect(Val.bool(true)).toMatchObject({ type: "bool", value: true });
  expect(Val.string("cosm")).toMatchObject({ type: "string", value: "cosm" });
  expect(Val.symbol("status")).toMatchObject({ type: "symbol", name: "status" });
  expect(Val.array([Val.number(1), Val.number(2)])).toMatchObject({
    type: "array",
    items: [Val.number(1), Val.number(2)],
  });
  expect(Val.hash({ answer: Val.number(42) })).toMatchObject({
    type: "hash",
    entries: { answer: Val.number(42) },
  });
});

test("primitive runtime values carry behavior", () => {
  expect(Val.number(20).plus(Val.number(22))).toMatchObject({ type: "number", value: 42 });
  expect(Val.string("co").plus(Val.string("sm"))).toMatchObject({ type: "string", value: "cosm" });
  expect(Val.string("answer: ").plus(Val.number(42))).toMatchObject({ type: "string", value: "answer: 42" });
  expect(Val.number(42).toCosmString()).toBe("42");
  expect(Val.bool(true).toCosmString()).toBe("true");
  expect(Val.symbol("ok").toCosmString()).toBe(":ok");
  expect(Val.number(1).nativeMethod("plus")?.nativeCall?.([Val.number(2)], Val.number(1))).toMatchObject({ type: "number", value: 3 });
  expect(Val.array([Val.number(1), Val.number(2)]).nativeProperty("length")).toMatchObject({ type: "number", value: 2 });
  expect(Val.hash({ answer: Val.number(42), ok: Val.bool(true) }).nativeProperty("length")).toMatchObject({ type: "number", value: 2 });
});

test("shared runtime eq hook covers structural and identity cases", () => {
  expect(RuntimeEquality.compare(
    Val.array([Val.number(1), Val.string("ok")]),
    Val.array([Val.number(1), Val.string("ok")]),
  )).toBe(true);
  expect(RuntimeEquality.compare(
    Val.hash({ answer: Val.number(42) }),
    Val.hash({ answer: Val.number(42) }),
  )).toBe(true);
  const fn = Val.nativeFunc("id", () => Val.bool(true));
  expect(RuntimeEquality.compare(fn, fn)).toBe(true);
});

test("callable and reflective constructors preserve metadata", () => {
  const env = { bindings: {} };
  const body = { kind: "block", value: "", children: [] } as const;
  const classMeta = Val.class("Number class", "Class");
  const baseMethod = Val.nativeFunc("base", () => Val.bool(true));
  const baseMeta = Val.class("Base class", "Class", [], { label: Val.nativeFunc("label", () => Val.string("ok")) });
  const baseClass = Val.class("Base", "Object", [], { base: baseMethod }, {}, undefined, baseMeta);
  const numberClass = Val.class("Number", "Object", [], {}, {}, baseClass, classMeta);

  expect(numberClass).toMatchObject({
    type: "class",
    name: "Number",
    superclassName: "Object",
    superclass: baseClass,
    methods: {},
  });
  expect(numberClass.nativeProperty("metaclass")).toBe(classMeta);
  expect(numberClass.lookupInstanceMethod("base")).toBe(baseMethod);
  expect(baseClass.lookupClassSideMethod("label")?.name).toBe("label");
  expect(numberClass.nativeProperty("classMethods")).toMatchObject({
    type: "object",
    fields: {},
    className: "Namespace",
  });
  expect(Val.object("Point", { x: Val.number(1) })).toMatchObject({
    type: "object",
    className: "Point",
    fields: { x: Val.number(1) },
  });
  expect(Val.kernel({}, numberClass)).toMatchObject({
    type: "object",
    className: "Kernel",
  });
  expect(Val.namespace({}, numberClass)).toMatchObject({
    type: "object",
    className: "Namespace",
  });
  expect(Val.nativeFunc("assert", () => Val.bool(true))).toMatchObject({
    type: "function",
    name: "assert",
  });
  expect(Val.closure("join", ["rest"], body, env)).toMatchObject({
    type: "function",
    name: "join",
    params: ["rest"],
    body,
    env,
  });
});

test("core runtime manifests expose a consistent boot surface", () => {
  const objectClass = new CosmClassValue("Object");
  const classClass = new CosmClassValue("Class", "Object");
  const kernelClass = new CosmClassValue("Kernel", "Object");
  const namespaceClass = new CosmClassValue("Namespace", "Object");
  const moduleClass = new CosmClassValue("Module", "Object");
  const processClass = new CosmClassValue("Process", "Object");
  const timeClass = new CosmClassValue("Time", "Object");
  const randomClass = new CosmClassValue("Random", "Object");
  const httpRequestClass = new CosmClassValue("HttpRequest", "Object");
  const httpResponseClass = new CosmClassValue("HttpResponse", "Object");
  const httpRouterClass = new CosmClassValue("HttpRouter", "Object");
  const mirrorClass = new CosmClassValue("Mirror", "Object");
  const errorClass = new CosmClassValue("Error", "Object");
  const schemaClass = new CosmClassValue("Schema", "Object");
  const promptClass = new CosmClassValue("Prompt", "Object");
  const aiClass = new CosmClassValue("Ai", "Object");

  const objectMethods = manifestMethods(
    new CosmObjectValue("Object", {}, objectClass),
    CosmValueBase.manifest,
  );
  const classMethods = manifestMethods(classClass, CosmClassValue.manifest);
  const functionMethods = manifestMethods(
    new CosmFunctionValue("noop", () => Val.bool(true)),
    CosmFunctionValue.manifest,
  );
  const methodMethods = manifestMethods(
    new CosmMethodValue("noop", Val.bool(true), new CosmFunctionValue("noop", () => Val.bool(true))),
    CosmMethodValue.manifest,
  );
  const symbolMethods = manifestMethods(Val.symbol("ok"), CosmSymbolValue.manifest);
  const symbolClassMethods = manifestClassMethods(CosmSymbolValue.manifest);
  const namespaceMethods = manifestMethods(
    new CosmNamespaceValue({}, namespaceClass),
    CosmNamespaceValue.manifest,
  );
  const moduleMethods = manifestMethods(
    new CosmModuleValue("cosm/test", {}, moduleClass),
    CosmModuleValue.manifest,
  );
  const kernelMethods = manifestMethods(
    new CosmKernelValue({}, kernelClass),
    CosmKernelValue.manifest,
  );
  const processMethods = manifestMethods(
    new CosmProcessValue({}, processClass),
    CosmProcessValue.manifest,
  );
  const timeMethods = manifestMethods(
    new CosmTimeValue({}, timeClass),
    CosmTimeValue.manifest,
  );
  const randomMethods = manifestMethods(
    new CosmRandomValue({}, randomClass),
    CosmRandomValue.manifest,
  );
  const httpMethods = manifestMethods(
    new CosmHttpValue({}, new CosmClassValue("Http"), new CosmClassValue("HttpServer"), namespaceClass, httpRequestClass, httpResponseClass),
    CosmHttpValue.manifest,
  );
  const httpRequestMethods = manifestMethods(
    new CosmHttpRequestValue(
      "GET",
      "http://127.0.0.1:0/items?kind=test",
      "/items",
      new CosmNamespaceValue({ host: Val.string("127.0.0.1") }, namespaceClass),
      new CosmNamespaceValue({ kind: Val.string("test") }, namespaceClass),
      "payload",
      httpRequestClass,
    ),
    CosmHttpRequestValue.manifest,
  );
  const httpResponseMethods = manifestMethods(
    new CosmHttpResponseValue(200, Val.string("ok"), new CosmNamespaceValue({}, namespaceClass), httpResponseClass),
    CosmHttpResponseValue.manifest,
  );
  const httpResponseClassMethods = manifestClassMethods(CosmHttpResponseValue.manifest);
  const httpServerMethods = manifestMethods(
    new CosmHttpServerValue(undefined, 0, "", new CosmClassValue("HttpServer")),
    CosmHttpServerValue.manifest,
  );
  const httpRouterMethods = manifestMethods(
    new CosmHttpRouterValue({}, httpRouterClass, httpResponseClass, namespaceClass),
    CosmHttpRouterValue.manifest,
  );
  const mirrorMethods = manifestMethods(
    new CosmMirrorValue(Val.bool(true), mirrorClass),
    CosmMirrorValue.manifest,
  );
  const mirrorClassMethods = manifestClassMethods(CosmMirrorValue.manifest);
  const errorMethods = manifestMethods(
    new CosmErrorValue("boom", [], Val.bool(false), errorClass),
    CosmErrorValue.manifest,
  );
  const errorClassMethods = manifestClassMethods(CosmErrorValue.manifest);
  const schemaMethods = manifestMethods(
    new CosmSchemaValue("string", {}, schemaClass, errorClass),
    CosmSchemaValue.manifest,
  );
  const schemaClassMethods = manifestClassMethods(CosmSchemaValue.manifest);
  const promptMethods = manifestMethods(
    new CosmPromptValue("hello", promptClass),
    CosmPromptValue.manifest,
  );
  const promptClassMethods = manifestClassMethods(CosmPromptValue.manifest);
  const aiMethods = manifestMethods(
    new CosmAiValue({}, aiClass, errorClass),
    CosmAiValue.manifest,
  );
  CosmSessionValue.installRuntimeHooks({
    createHandle: () => ({
      eval: () => ({ ok: true, value: Val.bool(true), inspect: "true", error: false, history: [] }),
      tryEval: () => ({ ok: true, value: Val.bool(true), inspect: "true", error: false, history: [] }),
      reset: () => undefined,
      history: () => [],
    }),
    defaultSession: () => new CosmSessionValue("default", new CosmClassValue("Session"), errorClass),
  });
  const sessionMethods = manifestMethods(
    new CosmSessionValue("default", new CosmClassValue("Session"), errorClass),
    CosmSessionValue.manifest,
  );
  const sessionClassMethods = manifestClassMethods(CosmSessionValue.manifest);

  expect(Object.keys(objectMethods).sort()).toEqual(["eq", "inspect", "method", "methods", "send", "to_s"]);
  expect(Object.keys(classMethods).sort()).toEqual(["classMethod", "new"]);
  expect(Object.keys(functionMethods)).toEqual(["call"]);
  expect(Object.keys(methodMethods)).toEqual(["call"]);
  expect(Object.keys(symbolMethods).sort()).toEqual(["eq", "to_s"]);
  expect(Object.keys(symbolClassMethods)).toEqual(["intern"]);
  expect(Object.keys(namespaceMethods).sort()).toEqual(["get", "has", "keys", "values"]);
  expect(Object.keys(moduleMethods).sort()).toEqual(["get", "has", "keys", "values"]);
  expect(Object.keys(kernelMethods).sort()).toEqual([
    "assert",
    "blockGiven",
    "describe",
    "dispatch",
    "escapeHtml",
    "eval",
    "expectEqual",
    "inspect",
    "print",
    "puts",
    "raise",
    "readline",
    "resetSession",
    "resetTests",
    "send",
    "session",
    "sleep",
    "test",
    "testSummary",
    "trace",
    "try",
    "tryEval",
    "tryValidate",
    "uuid",
    "warn",
  ]);
  expect(Object.keys(processMethods).sort()).toEqual(["arch", "argv", "cwd", "env", "exit", "pid", "platform"]);
  expect(Object.keys(timeMethods).sort()).toEqual(["fromIso", "iso", "isoNow", "now"]);
  expect(Object.keys(randomMethods).sort()).toEqual(["choice", "float", "int"]);
  expect(Object.keys(httpMethods)).toEqual(["serve"]);
  expect(Object.keys(httpRequestMethods).sort()).toEqual(["bodyText", "form"]);
  expect(Object.keys(httpResponseMethods)).toEqual([]);
  expect(Object.keys(httpResponseClassMethods).sort()).toEqual(["html", "json", "ok", "text"]);
  expect(Object.keys(httpServerMethods)).toEqual(["stop"]);
  expect(Object.keys(httpRouterMethods).sort()).toEqual(["delete", "draw", "get", "handle", "post", "put", "use"]);
  expect(Object.keys(mirrorMethods).sort()).toEqual(["get", "has", "inspect", "methods"]);
  expect(Object.keys(mirrorClassMethods)).toEqual(["reflect"]);
  expect(Object.keys(errorMethods).sort()).toEqual(["inspect"]);
  expect(Object.keys(errorClassMethods)).toEqual(["new"]);
  expect(Object.keys(schemaMethods).sort()).toEqual(["describe", "inspect", "jsonSchema", "validate"]);
  expect(Object.keys(schemaClassMethods).sort()).toEqual(["array", "boolean", "enum", "number", "object", "optional", "string"]);
  expect(Object.keys(promptMethods)).toEqual([]);
  expect(Object.keys(promptClassMethods)).toEqual(["text"]);
  expect(Object.keys(aiMethods).sort()).toEqual(["cast", "compare", "complete", "status"]);
  expect(Object.keys(sessionMethods).sort()).toEqual(["eval", "history", "inspect", "reset", "to_s", "tryEval"]);
  expect(Object.keys(sessionClassMethods)).toEqual(["default"]);
});

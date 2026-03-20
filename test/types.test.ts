import { expect, test } from "bun:test";
import { Construct as Val } from "../src/Construct";

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

test("callable and reflective constructors preserve metadata", () => {
  const env = { bindings: {} };
  const body = { kind: "block", value: "", children: [] } as const;
  const classMeta = Val.class("Number class", "Class");
  const numberClass = Val.class("Number", "Object", [], {}, {}, undefined, classMeta);

  expect(numberClass).toMatchObject({
    type: "class",
    name: "Number",
    superclassName: "Object",
    superclass: undefined,
    methods: {},
  });
  expect(numberClass.nativeProperty("metaclass")).toBe(classMeta);
  expect(numberClass.nativeProperty("classMethods")).toMatchObject({
    type: "object",
    fields: {},
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

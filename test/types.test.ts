import { expect, test } from "bun:test";
import { Construct as Val } from "../src/Construct";

test("type constructors build expected runtime values", () => {
  expect(Val.number(42)).toEqual({ type: "number", value: 42 });
  expect(Val.bool(true)).toEqual({ type: "bool", value: true });
  expect(Val.string("cosm")).toEqual({ type: "string", value: "cosm" });
  expect(Val.array([Val.number(1), Val.number(2)])).toEqual({
    type: "array",
    items: [{ type: "number", value: 1 }, { type: "number", value: 2 }],
  });
  expect(Val.hash({ answer: Val.number(42) })).toEqual({
    type: "hash",
    entries: { answer: { type: "number", value: 42 } },
  });
});

test("callable and reflective constructors preserve metadata", () => {
  const env = { bindings: {} };
  const body = { kind: "block", value: "", children: [] } as const;

  expect(Val.class("Number", "Object")).toEqual({
    type: "class",
    name: "Number",
    superclassName: "Object",
    superclass: undefined,
    methods: {},
  });
  expect(Val.object("Point", { x: Val.number(1) })).toEqual({
    type: "object",
    className: "Point",
    fields: { x: { type: "number", value: 1 } },
  });
  expect(Val.nativeFunc("len", () => Val.number(0))).toMatchObject({
    type: "function",
    name: "len",
  });
  expect(Val.closure("join", ["rest"], body, env)).toEqual({
    type: "function",
    name: "join",
    params: ["rest"],
    body,
    env,
  });
});

import { expect, test } from "bun:test";
import { Types } from "../src/types";

test("type constructors build expected runtime values", () => {
  expect(Types.number(42)).toEqual({ type: "number", value: 42 });
  expect(Types.bool(true)).toEqual({ type: "bool", value: true });
  expect(Types.string("cosm")).toEqual({ type: "string", value: "cosm" });
  expect(Types.array([Types.number(1), Types.number(2)])).toEqual({
    type: "array",
    items: [{ type: "number", value: 1 }, { type: "number", value: 2 }],
  });
  expect(Types.hash({ answer: Types.number(42) })).toEqual({
    type: "hash",
    entries: { answer: { type: "number", value: 42 } },
  });
});

test("callable and reflective constructors preserve metadata", () => {
  const env = { bindings: {} };
  const body = { kind: "block", value: "", children: [] } as const;

  expect(Types.class("Number", "Object")).toEqual({
    type: "class",
    name: "Number",
    superclassName: "Object",
    superclass: undefined,
    methods: {},
  });
  expect(Types.object("Point", { x: Types.number(1) })).toEqual({
    type: "object",
    className: "Point",
    fields: { x: { type: "number", value: 1 } },
  });
  expect(Types.nativeFunc("len", () => Types.number(0))).toMatchObject({
    type: "function",
    name: "len",
  });
  expect(Types.closure("join", ["rest"], body, env)).toEqual({
    type: "function",
    name: "join",
    params: ["rest"],
    body,
    env,
  });
});

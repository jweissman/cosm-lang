import { expect, test } from "bun:test";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";

const cosmEval = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(input));

test("Kernel.inspect delegates to representative runtime values cleanly", () => {
  expect(cosmEval("Kernel.inspect(Kernel)")).toBe("#<Kernel>");
  expect(cosmEval('Kernel.inspect(HttpResponse.text("ok", 201))')).toBe('#<HttpResponse 201 "ok">');
  expect(cosmEval("Kernel.inspect(HttpRouter.new())")).toBe("#<HttpRouter routes: 0>");
});

test("receiver-side inspect stays available on representative objects", () => {
  expect(cosmEval('Symbol.intern("ok").inspect()')).toBe(":ok");
  expect(cosmEval('Error.new("boom").inspect()')).toBe('#<Error "boom">');
  expect(cosmEval('Schema.string().inspect()')).toBe("Schema.string()");
});

test("Mirror inspect remains wrapper-visible", () => {
  expect(cosmEval("Kernel.inspect(Mirror.reflect([1, 2]))")).toBe("#<Mirror [1, 2]>");
  expect(cosmEval('Mirror.reflect(HttpRouter.new()).inspect()')).toBe('#<Mirror #<HttpRouter routes: 0>>');
});

import { expect, test } from "bun:test";
import Cosm from "../src/cosm";

const cosmEval = (input: string) => {
  const cosmValue = Cosm.Interpreter.eval(input);
  return Cosm.Values.cosmToJS(cosmValue);
}

test("2 + 2", () => {
  expect(cosmEval('2 + 2')).toBe(4)
});

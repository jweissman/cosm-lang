import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";

const source = readFileSync("test/vm_support.cosm", "utf8");
const rounds = 25;

const measure = (label: string, fn: () => unknown) => {
  const started = performance.now();
  let last: unknown;
  for (let index = 0; index < rounds; index += 1) {
    last = fn();
  }
  const elapsedMs = performance.now() - started;
  return { label, rounds, elapsedMs, last };
};

const interpreter = measure("interpreter", () => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(source)));
const vm = measure("vm", () => ValueAdapter.cosmToJS(Cosm.Interpreter.evalVm(source)));

console.log(JSON.stringify({ interpreter, vm }, null, 2));

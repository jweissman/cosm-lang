import { execFileSync } from "node:child_process";
import { join } from "node:path";
import Cosm from "../../src/cosm";
import { ValueAdapter } from "../../src/ValueAdapter";

process.env.COSM_AI_AUTO_DISCOVER_MODEL ??= "0";

export const cosmEval = (input: string) => {
  const cosmValue = Cosm.Interpreter.eval(input);
  return ValueAdapter.cosmToJS(cosmValue);
};

export const cosmEvalWithoutAi = (input: string) => {
  const repoRoot = process.cwd();
  const env = { ...process.env, COSM_AI_AUTO_DISCOVER_MODEL: "0" };
  delete env.COSM_AI_BACKEND;
  delete env.COSM_AI_BASE_URL;
  delete env.COSM_AI_MODEL;
  const bunPath = Bun.which("bun") ?? "bun";
  return execFileSync(bunPath, [join(repoRoot, "bin/cosm"), "-e", `puts(${input})`], {
    cwd: "/tmp",
    env,
    encoding: "utf8",
  }).trim();
};

import { expect, test } from "bun:test";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";

const cosmEval = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(input));
const liveEnabled = process.env.COSM_AI_LIVE === "1";

test.if(liveEnabled)("LM Studio integration covers status, complete, cast, and compare", () => {
  const status = cosmEval("cosm.ai.status()") as {
    backend: string;
    baseUrl: string;
    model: string | false;
    configured: boolean;
  };

  expect(status.backend).toBe("lmstudio");
  expect(status.baseUrl).toBe("http://127.0.0.1:1234/v1");
  expect(status.configured).toBe(true);
  expect(typeof status.model).toBe("string");

  const completion = cosmEval('cosm.ai.complete("Reply with one short word about cosm.")');
  expect(typeof completion).toBe("string");
  expect((completion as string).length).toBeGreaterThan(0);

  expect(cosmEval('cosm.ai.cast("Return the exact string cosm as JSON.", Schema.string())')).toBe("cosm");
  expect(cosmEval('"cosm" ~= "cosm"')).toBe(true);
});

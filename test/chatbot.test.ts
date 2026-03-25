import { afterEach, expect, test } from "bun:test";
import Cosm from "../src/cosm";
import { AiRuntime } from "../src/runtime/AiRuntime";
import { ValueAdapter } from "../src/ValueAdapter";
import { CosmAiValue } from "../src/values/CosmAiValue";

const cosmEval = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(input));

afterEach(() => {
  CosmAiValue.installRuntimeHooks({
    status: () => AiRuntime.status(),
    complete: (prompt) => AiRuntime.complete(prompt),
    cast: (prompt, schema) => AiRuntime.cast(prompt, schema),
    compare: (left, right) => AiRuntime.compare(left, right),
  });
});

test("pure Cosm support chat can step a transcript through the shared support-agent core", () => {
  CosmAiValue.installRuntimeHooks({
    cast: (prompt, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm(
      prompt.includes("notebook session")
        ? {
            shouldReply: true,
            text: "Reset the session with the Reset Session button in the notebook UI.",
            rationale: "mocked support reply",
            toolCalls: false,
            toolResults: false,
          }
        : {
            shouldReply: true,
            text: "I am not sure yet.",
            rationale: "mocked default",
            toolCalls: false,
            toolResults: false,
          },
    )),
  });

  expect(cosmEval('require("support/chat.cosm"); chat.step("", "How do I reset the notebook session?").reply.text')).toBe(
    "Reset the session with the Reset Session button in the notebook UI.",
  );
  expect(cosmEval('require("support/chat.cosm"); chat.step("", "How do I reset the notebook session?").transcript')).toContain(
    "assistant: Reset the session with the Reset Session button in the notebook UI.",
  );
  expect(cosmEval('require("support/agent.cosm"); agent.stepTranscript("", "How do I reset the notebook session?").reply.text')).toBe(
    "Reset the session with the Reset Session button in the notebook UI.",
  );
});

test("pure Cosm support chat transcript helpers stay stable", () => {
  expect(cosmEval('require("support/chat.cosm"); chat.appendTranscript("", "user", "hello")')).toBe("user: hello");
  expect(cosmEval('require("support/chat.cosm"); chat.appendTranscript("user: hello", "assistant", "hi")')).toBe("user: hello\nassistant: hi");
});

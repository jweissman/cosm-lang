import { afterEach, expect, test } from "bun:test";
import Cosm from "../src/cosm";
import { AiRuntime } from "../src/runtime/AiRuntime";
import { ValueAdapter } from "../src/ValueAdapter";
import { CosmAiValue } from "../src/values/CosmAiValue";

const cosmEval = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(input));

afterEach(() => {
  CosmAiValue.installRuntimeHooks({
    status: () => AiRuntime.status(),
    health: () => AiRuntime.health(),
    complete: (prompt) => AiRuntime.complete(prompt),
    cast: (prompt, schema) => AiRuntime.cast(prompt, schema),
    compare: (left, right) => AiRuntime.compare(left, right),
    stream: (prompt, onEvent) => AiRuntime.stream(prompt, onEvent),
  });
});

test("pure Cosm support chat can step a transcript through the shared support-agent core", () => {
  CosmAiValue.installRuntimeHooks({
    cast: (prompt, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm(
      prompt.includes("notebook session")
        ? {
            should_reply: true,
            text: "Reset the session with the Reset Session button in the notebook UI.",
            rationale: "mocked support reply",
            tool_calls: false,
            tool_results: false,
          }
        : {
            should_reply: true,
            text: "I am not sure yet.",
            rationale: "mocked default",
            tool_calls: false,
            tool_results: false,
          },
    )),
  });

  expect(cosmEval('require "lib/support/chat"; Support::Chat.step("", "How do I reset the notebook session?").reply.text')).toBe(
    "Reset the session with the Reset Session button in the notebook UI.",
  );
  expect(cosmEval('require "lib/support/chat"; Support::Chat.step("", "How do I reset the notebook session?").transcript')).toContain(
    "assistant: Reset the session with the Reset Session button in the notebook UI.",
  );
  expect(cosmEval('require "lib/support/agent"; Support::Agent.step_transcript("", "How do I reset the notebook session?").reply.text')).toBe(
    "Reset the session with the Reset Session button in the notebook UI.",
  );
});

test("pure Cosm support chat transcript helpers stay stable", () => {
  expect(cosmEval('require "lib/support/chat"; Support::Chat.append_transcript("", "user", "hello")')).toBe("user: hello");
  expect(cosmEval('require "lib/support/chat"; Support::Chat.append_transcript("user: hello", "assistant", "hi")')).toBe("user: hello\nassistant: hi");
});

test("support controller provides a thin conversation contract for shared chat flows", () => {
  CosmAiValue.installRuntimeHooks({
    cast: (_prompt, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm({
      should_reply: true,
      text: "Reset the session with the Reset Session button in the notebook UI.",
      rationale: "mocked controller reply",
      tool_calls: false,
      tool_results: false,
    })),
  });

  expect(cosmEval(`
    require "lib/support/controller"
    let turn = Support::Controller.turn(Support::Controller.cli_conversation([]), Support::Controller.cli_inbound("How do I reset the notebook session?"))
    turn.reply.text
  `)).toBe("Reset the session with the Reset Session button in the notebook UI.");

  expect(cosmEval(`
    require "lib/support/controller"
    let turn = Support::Controller.turn(Support::Controller.cli_conversation([]), Support::Controller.cli_inbound("How do I reset the notebook session?"))
    turn.conversation.messages.length
  `)).toBe(2);

  expect(cosmEval(`
    require "lib/support/controller"
    let turn = Support::Controller.turn(Support::Controller.page_conversation("page-1", "user: hello"), Support::Controller.page_inbound("page-1", "How do I reset the notebook session?"))
    Support::Controller.display_transcript(turn.conversation)
  `)).toContain("assistant: Reset the session with the Reset Session button in the notebook UI.");
});

test("support prompt data is loaded from markdown-backed prompt files", () => {
  expect(cosmEval('require "lib/support/prompt_data"; Support::PromptData.iapetus_system().length > 10')).toBe(true);
});

test("pure Cosm support chat can stream chunks through the shared chat loop helpers", () => {
  CosmAiValue.installRuntimeHooks({
    stream: (prompt, onEvent) => {
      onEvent({ kind: "waiting", index: 0, text: "iapetus> [thinking |]" });
      onEvent({ kind: "chunk", text: "Reset ", first: true, index: 0 });
      onEvent({ kind: "chunk", text: "the session.", first: false, index: 1 });
      onEvent({ kind: "done", text: "Reset the session.", index: 2 });
      return ValueAdapter.jsToCosm(`Reset the session.`);
    },
  });

  let stdout = "";
  const originalWrite = process.stdout.write;
  (process.stdout as unknown as { write: typeof process.stdout.write }).write = ((chunk: string | Uint8Array) => {
    stdout += String(chunk);
    return true;
  }) as typeof process.stdout.write;

  try {
    expect(cosmEval(`
      require "lib/support/chat"
      let result = Support::Chat.stream_step("", "How do I reset the notebook session?") do |event|
        Support::Chat.render_stream_event(event)
      end
      result.reply.text
    `)).toBe("Reset the session.");
  } finally {
    (process.stdout as unknown as { write: typeof process.stdout.write }).write = originalWrite;
  }

  expect(stdout).toContain("[thinking |]");
  expect(stdout).toContain("Reset ");
  expect(stdout).toContain("the session.");
  expect(stdout).not.toContain("\\r");
});

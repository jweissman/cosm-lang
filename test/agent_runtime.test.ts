import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Cosm from "../src/cosm";
import { ValueAdapter } from "../src/ValueAdapter";
import { AiRuntime } from "../src/runtime/AiRuntime";
import { CosmAiValue } from "../src/values/CosmAiValue";
import { CosmHttpValue } from "../src/values/CosmHttpValue";

const cosmEval = (input: string) => ValueAdapter.cosmToJS(Cosm.Interpreter.eval(input));

const originalHttpHooks = CosmHttpValue.currentRuntimeHooks();
const originalSigningSecret = process.env.SLACK_SIGNING_SECRET;
const originalBotToken = process.env.SLACK_BOT_TOKEN;
const originalSlackDir = process.env.SLACK_STORAGE_DIR;
const originalSlackApiUrl = process.env.SLACK_API_URL;

afterEach(() => {
  process.env.SLACK_SIGNING_SECRET = originalSigningSecret;
  process.env.SLACK_BOT_TOKEN = originalBotToken;
  process.env.SLACK_STORAGE_DIR = originalSlackDir;
  process.env.SLACK_API_URL = originalSlackApiUrl;
  CosmHttpValue.installRuntimeHooks({
    invoke: originalHttpHooks.invoke!,
    lookupMethod: originalHttpHooks.lookupMethod!,
    request: originalHttpHooks.request,
  });
  CosmAiValue.installRuntimeHooks({
    status: () => AiRuntime.status(),
    health: () => AiRuntime.health(),
    complete: (prompt) => AiRuntime.complete(prompt),
    cast: (prompt, schema) => AiRuntime.cast(prompt, schema),
    compare: (left, right) => AiRuntime.compare(left, right),
  });
});

test("agent runtime executes and persists a transport-agnostic stored turn", () => {
  const dir = mkdtempSync(join(tmpdir(), "cosm-agent-runtime-"));
  process.env.SLACK_STORAGE_DIR = dir;

  CosmAiValue.installRuntimeHooks({
    cast: (_prompt, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm({
      should_reply: true,
      text: "Reset it from the notebook session controls.",
      rationale: "mocked",
      tool_calls: false,
      tool_results: false,
    })),
  });

  expect(cosmEval(`
    require "agent/runtime"
    let inbound = { channel: "D100", thread: "1710000100.000001", user: "U100", text: "How do I reset it?", ts: "1710000100.000001" }
    let turn = Agent::Runtime.execute_stored_turn(inbound)
    {
      reply: turn.reply.text,
      session_name: turn.conversation.session_name,
      messages: turn.conversation.messages.length,
      persisted: Agent::Runtime.load_conversation(inbound).messages.length
    }
  `)).toEqual({
    reply: "Reset it from the notebook session controls.",
    session_name: "agent:D100:1710000100.000001",
    messages: 2,
    persisted: 2,
  });

  rmSync(dir, { recursive: true, force: true });
});

test("agent runtime handles commands transport-agnostically", () => {
  expect(cosmEval(`
    require "agent/runtime"
    let inbound = { channel: "D200", thread: "1710000200.000001", user: "U200", text: "status", ts: "1710000200.000001" }
    let conversation = Agent::Runtime.conversation_for_inbound(inbound)
    let turn = Agent::Runtime.execute_turn(conversation, inbound)
    {
      command: turn.command,
      should_reply: turn.reply.should_reply,
      session_name: turn.conversation.session_name
    }
  `)).toEqual({
    command: "status",
    should_reply: true,
    session_name: "agent:D200:1710000200.000001",
  });
});

test("local Iapetus chat reuses the shared runtime and durable store", () => {
  const dir = mkdtempSync(join(tmpdir(), "cosm-agent-chat-"));
  process.env.SLACK_STORAGE_DIR = dir;

  CosmAiValue.installRuntimeHooks({
    cast: (prompt, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm(
      prompt.includes("Session.default().reset()")
        ? {
            should_reply: true,
            text: "You can also inspect the current stored conversation with status.",
            rationale: "mocked follow-up",
            tool_calls: false,
            tool_results: false,
          }
        : {
            should_reply: true,
            text: "You can call Session.default().reset() to clear it in code.",
            rationale: "mocked first reply",
            tool_calls: false,
            tool_results: false,
          },
    )),
  });

  expect(cosmEval(`
    require "agent/chat"
    let first = Agent::Chat.step("How do I reset it?")
    let second = Agent::Chat.step("Any code path?")
    let status = Agent::Chat.status()
    {
      first_reply: first.reply.text,
      second_reply: second.reply.text,
      session_name: second.conversation.session_name,
      messages: status.messages,
      known_conversations: status.runtime.storage.known_conversations
    }
  `)).toEqual({
    first_reply: "You can call Session.default().reset() to clear it in code.",
    second_reply: "You can also inspect the current stored conversation with status.",
    session_name: "agent:local:cli:iapetus",
    messages: 4,
    known_conversations: 1,
  });

  rmSync(dir, { recursive: true, force: true });
});

test("local Iapetus chat routes help, status, and reset through the shared runtime path", () => {
  const dir = mkdtempSync(join(tmpdir(), "cosm-agent-chat-commands-"));
  process.env.SLACK_STORAGE_DIR = dir;

  expect(cosmEval(`
    require "agent/chat"
    Agent::Chat.step("status")
    let reset = Agent::Chat.step("reset")
    let status = Agent::Chat.status()
    {
      reset_reply: reset.reply.text,
      messages: status.messages,
      key: status.conversation_key
    }
  `)).toEqual({
    reset_reply: "Conversation memory cleared. The next message starts from a clean transcript and named session.",
    messages: 0,
    key: "local:cli:iapetus",
  });

  rmSync(dir, { recursive: true, force: true });
});

test("slack dm smoke helper sends one outbound message through the shared slack client", () => {
  process.env.SLACK_BOT_TOKEN = "xoxb-smoke";
  process.env.SLACK_API_URL = "https://slack.test/api/chat.postMessage";

  const calls: Array<{ method: string; url: string; body?: string }> = [];
  CosmHttpValue.installRuntimeHooks({
    invoke: originalHttpHooks.invoke!,
    lookupMethod: originalHttpHooks.lookupMethod!,
    request: (method, url, options) => {
      calls.push({ method, url, body: options.body });
      return { status: 200, body: JSON.stringify({ ok: true, channel: "DCLI", ts: "1710000300.000001" }) };
    },
  });

  expect(cosmEval(`
    require "agent/slack_dm"
    let result = Agent::SlackDM.post_message("DCLI", "smoke test")
    {
      ok: result.ok,
      channel_id: result.channel_id,
      ts: result.ts
    }
  `)).toEqual({
    ok: true,
    channel_id: "DCLI",
    ts: "1710000300.000001",
  });
  expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0].body ?? "{}")).toMatchObject({ channel: "DCLI", text: "smoke test" });
});

test("slack dm smoke helper usage describes channel ids clearly", () => {
  expect(cosmEval(`
    require "agent/slack_dm"
    Agent::SlackDM.usage()
  `)).toContain("<channel_id>");
  expect(cosmEval(`
    require "agent/slack_dm"
    Agent::SlackDM.usage()
  `)).toContain("usually starting with D");
});

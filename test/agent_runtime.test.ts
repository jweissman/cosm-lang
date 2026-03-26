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
      shouldReply: true,
      text: "Reset it from the notebook session controls.",
      rationale: "mocked",
      toolCalls: false,
      toolResults: false,
    })),
  });

  expect(cosmEval(`
    let agent_runtime = require("agent/runtime.cosm")
    let inbound = { channel: "D100", thread: "1710000100.000001", user: "U100", text: "How do I reset it?", ts: "1710000100.000001" }
    let turn = agent_runtime.execute_stored_turn(inbound)
    {
      reply: turn.reply.text,
      sessionName: turn.conversation.sessionName,
      messages: turn.conversation.messages.length,
      persisted: agent_runtime.load_conversation(inbound).messages.length
    }
  `)).toEqual({
    reply: "Reset it from the notebook session controls.",
    sessionName: "agent:D100:1710000100.000001",
    messages: 2,
    persisted: 2,
  });

  rmSync(dir, { recursive: true, force: true });
});

test("agent runtime handles commands transport-agnostically", () => {
  expect(cosmEval(`
    let agent_runtime = require("agent/runtime.cosm")
    let inbound = { channel: "D200", thread: "1710000200.000001", user: "U200", text: "status", ts: "1710000200.000001" }
    let conversation = agent_runtime.conversation_for_inbound(inbound)
    let turn = agent_runtime.execute_turn(conversation, inbound)
    {
      command: turn.command,
      shouldReply: turn.reply.shouldReply,
      sessionName: turn.conversation.sessionName
    }
  `)).toEqual({
    command: "status",
    shouldReply: true,
    sessionName: "agent:D200:1710000200.000001",
  });
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
    let slack_dm = require("agent/slack_dm.cosm")
    let result = slack_dm.send("DCLI", "smoke test")
    {
      ok: result.ok,
      channel: result.channel,
      ts: result.ts
    }
  `)).toEqual({
    ok: true,
    channel: "DCLI",
    ts: "1710000300.000001",
  });
  expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0].body ?? "{}")).toMatchObject({ channel: "DCLI", text: "smoke test" });
});

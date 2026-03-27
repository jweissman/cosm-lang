import { afterEach, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Cosm from "../src/cosm";
import { AiRuntime } from "../src/runtime/AiRuntime";
import { ValueAdapter } from "../src/ValueAdapter";
import { CosmAiValue } from "../src/values/CosmAiValue";
import { CosmHttpValue } from "../src/values/CosmHttpValue";
import { dispatchService } from "./support/request_spec";

const originalSigningSecret = process.env.SLACK_SIGNING_SECRET;
const originalBotToken = process.env.SLACK_BOT_TOKEN;
const originalLegacySigningSecret = process.env.COSM_SLACK_SIGNING_SECRET;
const originalLegacyBotToken = process.env.COSM_SLACK_BOT_TOKEN;
const originalSlackInline = process.env.COSM_SLACK_INLINE_SESSION;
const originalAgentInline = process.env.AGENT_INLINE_SESSION;
const originalSlackDir = process.env.SLACK_STORAGE_DIR;
const originalLegacySlackDir = process.env.COSM_SLACK_DIR;
const originalSlackApiUrl = process.env.SLACK_API_URL;
const originalLegacySlackApiUrl = process.env.COSM_SLACK_API_URL;
const originalAllowedChannels = process.env.SLACK_ALLOWED_CHANNELS;
const originalHttpHooks = CosmHttpValue.currentRuntimeHooks();

const serviceSource = `
  let service = require("lib/agent/service.cosm")
  service.AgentService.build()
`;

const signBody = (body: string, secret: string, timestamp: string) => {
  const base = `v0:${timestamp}:${body}`;
  return `v0=${createHmac("sha256", secret).update(base).digest("hex")}`;
};

type SlackCall = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
};

function installSlackApiHook(responseFactory?: (call: SlackCall) => { status: number; body: string }) {
  const calls: SlackCall[] = [];
  CosmHttpValue.installRuntimeHooks({
    invoke: originalHttpHooks.invoke!,
    lookupMethod: originalHttpHooks.lookupMethod!,
    request: (method, url, options) => {
      const call = {
        method,
        url,
        headers: options.headers,
        body: options.body ?? "",
      };
      calls.push(call);
      if (responseFactory) {
        return responseFactory(call);
      }
      return { status: 200, body: JSON.stringify({ ok: true }) };
    },
  });
  return {
    calls,
    url: "https://slack.test/api/chat.postMessage",
    stop: () => CosmHttpValue.installRuntimeHooks({
      invoke: originalHttpHooks.invoke!,
      lookupMethod: originalHttpHooks.lookupMethod!,
      request: originalHttpHooks.request,
    }),
  };
}

afterEach(() => {
  process.env.SLACK_SIGNING_SECRET = originalSigningSecret;
  process.env.SLACK_BOT_TOKEN = originalBotToken;
  process.env.COSM_SLACK_SIGNING_SECRET = originalLegacySigningSecret;
  process.env.COSM_SLACK_BOT_TOKEN = originalLegacyBotToken;
  process.env.COSM_SLACK_INLINE_SESSION = originalSlackInline;
  process.env.AGENT_INLINE_SESSION = originalAgentInline;
  process.env.SLACK_STORAGE_DIR = originalSlackDir;
  process.env.COSM_SLACK_DIR = originalLegacySlackDir;
  process.env.SLACK_API_URL = originalSlackApiUrl;
  process.env.COSM_SLACK_API_URL = originalLegacySlackApiUrl;
  process.env.SLACK_ALLOWED_CHANNELS = originalAllowedChannels;
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
    chatCast: (messages, schema) => AiRuntime.chatCast(messages, schema),
    compare: (left, right) => AiRuntime.compare(left, right),
  });
});

function withSlackEnv(useLegacyOnly = false, allowedChannels?: string[]) {
  if (useLegacyOnly) {
    delete process.env.SLACK_SIGNING_SECRET;
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_STORAGE_DIR;
    delete process.env.SLACK_API_URL;
  } else {
    process.env.SLACK_SIGNING_SECRET = "signing-secret";
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
  }
  process.env.COSM_SLACK_SIGNING_SECRET = "signing-secret";
  process.env.COSM_SLACK_BOT_TOKEN = "xoxb-test";
  process.env.COSM_SLACK_INLINE_SESSION = "1";
  process.env.AGENT_INLINE_SESSION = "1";
  const dir = mkdtempSync(join(tmpdir(), "cosm-slack-"));
  process.env.SLACK_STORAGE_DIR = dir;
  process.env.COSM_SLACK_DIR = dir;
  if (allowedChannels) {
    process.env.SLACK_ALLOWED_CHANNELS = allowedChannels.join(",");
  } else {
    delete process.env.SLACK_ALLOWED_CHANNELS;
  }
  return () => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

function dispatchSlack(body: string, timestamp: string) {
  return dispatchService(serviceSource, "POST", "/slack/events", {
    body,
    headers: {
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signBody(body, process.env.SLACK_SIGNING_SECRET ?? process.env.COSM_SLACK_SIGNING_SECRET!, timestamp),
    },
  });
}

test("slack dm ingress verifies, reuses a session, and posts a structured reply through the separate agent service", async () => {
  const cleanup = withSlackEnv();
  const slackApi = installSlackApiHook();
  process.env.SLACK_API_URL = slackApi.url;
  process.env.COSM_SLACK_API_URL = slackApi.url;

  CosmAiValue.installRuntimeHooks({
    chatCast: (messages, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm(
      messages.some((entry) => entry.content.includes("Reset the session with the Reset Session button"))
        ? {
            should_reply: true,
            text: "You can also call Session.default().reset() from Cosm if you need to reset it in code.",
            rationale: "mocked follow-up",
          }
        : {
            should_reply: true,
            text: "Reset the session with the Reset Session button in the notebook UI.",
            rationale: "mocked",
          },
    )),
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    type: "event_callback",
    event_id: "Ev-first",
    event: {
      type: "message",
      channel_type: "im",
      channel: "D123",
      user: "U123",
      text: "How do I reset the session?",
      ts: "1710000000.000001",
    },
  });

  const response = dispatchSlack(body, timestamp);
  expect(ValueAdapter.cosmToJS(response.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(String(ValueAdapter.cosmToJS(response.nativeProperty?.("body"))))).toMatchObject({ ok: true, replied: true });
  expect(slackApi.calls).toHaveLength(1);
  expect(JSON.parse(slackApi.calls[0].body)).toMatchObject({
    channel: "D123",
    text: "Reset the session with the Reset Session button in the notebook UI.",
    thread_ts: "1710000000.000001",
  });

  const followUpBody = JSON.stringify({
    type: "event_callback",
    event_id: "Ev-second",
    event: {
      type: "message",
      channel_type: "im",
      channel: "D123",
      user: "U123",
      text: "Any code path for that?",
      ts: "1710000001.000001",
      thread_ts: "1710000000.000001",
    },
  });

  const followUpResponse = dispatchSlack(followUpBody, timestamp);
  expect(ValueAdapter.cosmToJS(followUpResponse.nativeProperty?.("status"))).toBe(200);
  expect(slackApi.calls).toHaveLength(2);
  expect(JSON.parse(slackApi.calls[1].body)).toMatchObject({
    channel: "D123",
    text: "You can also call Session.default().reset() from Cosm if you need to reset it in code.",
    thread_ts: "1710000000.000001",
  });

  slackApi.stop();
  cleanup();
});

test("slack service shapes AI failures into a human-readable fallback reply", async () => {
  const cleanup = withSlackEnv();
  const slackApi = installSlackApiHook();
  process.env.SLACK_API_URL = slackApi.url;
  process.env.COSM_SLACK_API_URL = slackApi.url;

  CosmAiValue.installRuntimeHooks({
    chatCast: () => {
      throw new Error("AI backend is not configured for cast");
    },
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    type: "event_callback",
    event_id: "Ev-fallback",
    event: {
      type: "message",
      channel_type: "im",
      channel: "D999",
      user: "U999",
      text: "Can you help me?",
      ts: "1710000002.000001",
    },
  });

  const response = dispatchSlack(body, timestamp);
  expect(ValueAdapter.cosmToJS(response.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(slackApi.calls[0].body)).toMatchObject({
    channel: "D999",
    text: "I hit a support-agent hiccup while handling that DM. Please try again in a bit.",
    thread_ts: "1710000002.000001",
  });

  slackApi.stop();
  cleanup();
});

test("slack service dedupes duplicate deliveries persistently", async () => {
  const cleanup = withSlackEnv();
  const slackApi = installSlackApiHook();
  process.env.SLACK_API_URL = slackApi.url;
  process.env.COSM_SLACK_API_URL = slackApi.url;

  CosmAiValue.installRuntimeHooks({
    chatCast: (_messages, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm({
      should_reply: true,
      text: "First reply in a durable DM thread.",
      rationale: "mocked initial",
    })),
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    type: "event_callback",
    event_id: "Ev-dedupe",
    event: {
      type: "message",
      channel_type: "im",
      channel: "D777",
      user: "U777",
      text: "First question?",
      ts: "1710000010.000001",
    },
  });

  const first = dispatchSlack(body, timestamp);
  expect(ValueAdapter.cosmToJS(first.nativeProperty?.("status"))).toBe(200);
  expect(slackApi.calls).toHaveLength(1);

  const duplicate = dispatchSlack(body, timestamp);
  expect(ValueAdapter.cosmToJS(duplicate.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(String(ValueAdapter.cosmToJS(duplicate.nativeProperty?.("body"))))).toMatchObject({ ok: true, deduped: true });
  expect(slackApi.calls).toHaveLength(1);

  slackApi.stop();
  cleanup();
});

test("slack service ignores bot and non-dm events", async () => {
  const cleanup = withSlackEnv();
  const slackApi = installSlackApiHook();
  process.env.SLACK_API_URL = slackApi.url;
  process.env.COSM_SLACK_API_URL = slackApi.url;

  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    type: "event_callback",
    event_id: "Ev-ignored",
    event: {
      type: "message",
      channel_type: "channel",
      channel: "C123",
      user: "U123",
      text: "hello",
      ts: "1710000012.000001",
      bot_id: "B123",
    },
  });

  const response = dispatchSlack(body, timestamp);
  expect(ValueAdapter.cosmToJS(response.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(String(ValueAdapter.cosmToJS(response.nativeProperty?.("body"))))).toMatchObject({ ok: true, ignored: true });
  expect(slackApi.calls).toHaveLength(0);

  slackApi.stop();
  cleanup();
});

test("slack service accepts app mentions in allowed public channels and reuses the thread without another mention", async () => {
  const cleanup = withSlackEnv(false, ["C123"]);
  const slackApi = installSlackApiHook();
  process.env.SLACK_API_URL = slackApi.url;
  process.env.COSM_SLACK_API_URL = slackApi.url;

  CosmAiValue.installRuntimeHooks({
    chatCast: (messages, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm(
      messages.some((entry) => entry.content.includes("Second channel turn"))
        ? { should_reply: true, text: "Channel follow-up reply.", rationale: "follow-up" }
        : { should_reply: true, text: "Channel mention reply.", rationale: "mention" },
    )),
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const mentionBody = JSON.stringify({
    type: "event_callback",
    event_id: "Ev-channel-mention",
    event: {
      type: "app_mention",
      channel: "C123",
      channel_type: "channel",
      user: "U123",
      text: "<@UAPP> Hello from channel",
      ts: "1711000000.000001",
    },
  });

  const mentionResponse = dispatchSlack(mentionBody, timestamp);
  expect(ValueAdapter.cosmToJS(mentionResponse.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(slackApi.calls[0].body)).toMatchObject({
    channel: "C123",
    text: "Channel mention reply.",
    thread_ts: "1711000000.000001",
  });

  const followUpBody = JSON.stringify({
    type: "event_callback",
    event_id: "Ev-channel-followup",
    event: {
      type: "message",
      channel: "C123",
      channel_type: "channel",
      user: "U123",
      text: "Second channel turn",
      ts: "1711000001.000001",
      thread_ts: "1711000000.000001",
    },
  });

  const followUpResponse = dispatchSlack(followUpBody, timestamp);
  expect(ValueAdapter.cosmToJS(followUpResponse.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(slackApi.calls[1].body)).toMatchObject({
    channel: "C123",
    text: "Channel follow-up reply.",
    thread_ts: "1711000000.000001",
  });

  slackApi.stop();
  cleanup();
});

test("slack service accepts app mentions in allowed private channels", async () => {
  const cleanup = withSlackEnv(false, ["G123"]);
  const slackApi = installSlackApiHook();
  process.env.SLACK_API_URL = slackApi.url;
  process.env.COSM_SLACK_API_URL = slackApi.url;

  CosmAiValue.installRuntimeHooks({
    chatCast: (_messages, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm({
      should_reply: true,
      text: "Private channel mention reply.",
      rationale: "private mention",
    })),
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    type: "event_callback",
    event_id: "Ev-private-mention",
    event: {
      type: "app_mention",
      channel: "G123",
      user: "U555",
      text: "<@UAPP> hello in private",
      ts: "1711000010.000001",
    },
  });

  const response = dispatchSlack(body, timestamp);
  expect(ValueAdapter.cosmToJS(response.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(slackApi.calls[0].body)).toMatchObject({
    channel: "G123",
    text: "Private channel mention reply.",
    thread_ts: "1711000010.000001",
  });

  slackApi.stop();
  cleanup();
});

test("slack service ignores unallowed channel traffic and unactivated channel chatter", async () => {
  const cleanup = withSlackEnv(false, ["C999"]);
  const slackApi = installSlackApiHook();
  process.env.SLACK_API_URL = slackApi.url;
  process.env.COSM_SLACK_API_URL = slackApi.url;

  const timestamp = String(Math.floor(Date.now() / 1000));
  const unallowedMention = JSON.stringify({
    type: "event_callback",
    event_id: "Ev-unallowed-channel",
    event: {
      type: "app_mention",
      channel: "C123",
      channel_type: "channel",
      user: "U123",
      text: "<@UAPP> should ignore",
      ts: "1711000020.000001",
    },
  });
  const unallowedResponse = dispatchSlack(unallowedMention, timestamp);
  expect(ValueAdapter.cosmToJS(unallowedResponse.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(String(ValueAdapter.cosmToJS(unallowedResponse.nativeProperty?.("body"))))).toMatchObject({ ok: true, ignored: true });

  const unactivatedThread = JSON.stringify({
    type: "event_callback",
    event_id: "Ev-unactivated-thread",
    event: {
      type: "message",
      channel: "C999",
      channel_type: "channel",
      user: "U123",
      text: "thread follow-up without mention",
      ts: "1711000021.000001",
      thread_ts: "1711000000.000001",
    },
  });
  const unactivatedResponse = dispatchSlack(unactivatedThread, timestamp);
  expect(ValueAdapter.cosmToJS(unactivatedResponse.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(String(ValueAdapter.cosmToJS(unactivatedResponse.nativeProperty?.("body"))))).toMatchObject({ ok: true, ignored: true });
  expect(slackApi.calls).toHaveLength(0);

  slackApi.stop();
  cleanup();
});

test("slack service reset clears only the current thread state", async () => {
  const cleanup = withSlackEnv();
  const slackApi = installSlackApiHook();
  process.env.SLACK_API_URL = slackApi.url;
  process.env.COSM_SLACK_API_URL = slackApi.url;

  CosmAiValue.installRuntimeHooks({
    chatCast: (_messages, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm({
      should_reply: true,
      text: "Fresh AI reply after reset.",
      rationale: "mocked",
    })),
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const resetBody = JSON.stringify({
    type: "event_callback",
    event_id: "Ev-reset",
    event: {
      type: "message",
      channel_type: "im",
      channel: "D555",
      user: "U555",
      text: "reset",
      ts: "1710000020.000001",
    },
  });

  const resetResponse = dispatchSlack(resetBody, timestamp);
  expect(ValueAdapter.cosmToJS(resetResponse.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(slackApi.calls[0].body)).toMatchObject({
    channel: "D555",
    text: "Conversation memory cleared. The next message starts from a clean transcript and named session.",
    thread_ts: "1710000020.000001",
  });

  const followUpBody = JSON.stringify({
    type: "event_callback",
    event_id: "Ev-reset-followup",
    event: {
      type: "message",
      channel_type: "im",
      channel: "D555",
      user: "U555",
      text: "Hello again",
      ts: "1710000021.000001",
      thread_ts: "1710000020.000001",
    },
  });

  const followUpResponse = dispatchSlack(followUpBody, timestamp);
  expect(ValueAdapter.cosmToJS(followUpResponse.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(slackApi.calls[1].body)).toMatchObject({
    channel: "D555",
    text: "Fresh AI reply after reset.",
    thread_ts: "1710000020.000001",
  });

  slackApi.stop();
  cleanup();
});

test("slack service exposes readiness and status surfaces", async () => {
  const cleanup = withSlackEnv();
  const slackApi = installSlackApiHook();
  process.env.SLACK_API_URL = slackApi.url;
  process.env.COSM_SLACK_API_URL = slackApi.url;

  CosmAiValue.installRuntimeHooks({
    status: () => ValueAdapter.jsToCosm({ backend: "mock", baseUrl: slackApi.url, model: "mock-model", configured: true }),
    health: () => ValueAdapter.jsToCosm({ ok: true, error: false }),
  });

  const ready = dispatchService(serviceSource, "GET", "/ready");
  expect(ValueAdapter.cosmToJS(ready.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(String(ValueAdapter.cosmToJS(ready.nativeProperty?.("body"))))).toMatchObject({
    ok: true,
    path: "/ready",
    slack: { signing_secret: true, bot_token: true, storage_writable: true, webhook_driven: true, dm_enabled: true, mention_mode: true },
    ai: { configured: true, health: true },
    agent: { name: "iapetus", mode: "single-turn" },
  });

  const status = dispatchService(serviceSource, "GET", "/status");
  expect(ValueAdapter.cosmToJS(status.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(String(ValueAdapter.cosmToJS(status.nativeProperty?.("body"))))).toMatchObject({
    ok: true,
    path: "/status",
    slack: { transport: "slack", webhook_driven: true, dm_enabled: true, mention_mode: true, channel_mentions_enabled: false, allowed_channels: [] },
    agent: { name: "iapetus", mode: "single-turn", storage: { recent_activity: expect.any(Array) } },
  });

  slackApi.stop();
  cleanup();
});

test("slack diagnostics can list visible conversations and fetch channel history through the shared slack client", async () => {
  const cleanup = withSlackEnv(false, ["C123", "G123"]);
  const slackApi = installSlackApiHook((call) => {
    if (call.url.endsWith("/auth.test")) {
      return { status: 200, body: JSON.stringify({ ok: true, team: "Cosm", user_id: "UAPP", bot_id: "BAPP" }) };
    }
    if (call.url.endsWith("/conversations.list")) {
      return {
        status: 200,
        body: JSON.stringify({
          ok: true,
          channels: [
            { id: "C123", name: "iapetus", is_private: false, is_im: false, is_member: true },
            { id: "G123", name: "secret-room", is_private: true, is_im: false, is_member: true },
          ],
        }),
      };
    }
    if (call.url.endsWith("/conversations.history")) {
      return {
        status: 200,
        body: JSON.stringify({
          ok: true,
          messages: [
            { ts: "1711.1", user: "U123", text: "hello", thread_ts: "1711.1" },
            { ts: "1711.2", user: "UAPP", text: "hi there", thread_ts: "1711.1" },
          ],
        }),
      };
    }
    if (call.url.endsWith("/conversations.replies")) {
      return {
        status: 200,
        body: JSON.stringify({
          ok: true,
          messages: [
            { ts: "1711.1", user: "U123", text: "hello", thread_ts: "1711.1" },
            { ts: "1711.2", user: "UAPP", text: "hi there", thread_ts: "1711.1" },
          ],
        }),
      };
    }
    return { status: 200, body: JSON.stringify({ ok: true }) };
  });
  process.env.SLACK_API_URL = slackApi.url;
  process.env.COSM_SLACK_API_URL = slackApi.url;

  const status = ValueAdapter.cosmToJS(Cosm.Interpreter.eval(`
    require "lib/agent/slack_diag"
    Agent::SlackDiag.status()
  `));
  expect(status).toMatchObject({
    ok: true,
    ingress: { channel_mentions_enabled: true, allowed_channels: ["C123", "G123"] },
  });

  const conversations = ValueAdapter.cosmToJS(Cosm.Interpreter.eval(`
    require "lib/agent/slack_diag"
    Agent::SlackDiag.visible_conversations()
  `));
  expect(conversations).toMatchObject({
    ok: true,
    conversations: [
      { id: "C123", name: "iapetus" },
      { id: "G123", name: "secret-room" },
    ],
  });

  const history = ValueAdapter.cosmToJS(Cosm.Interpreter.eval(`
    require "lib/agent/slack_diag"
    Agent::SlackDiag.history("C123")
  `));
  expect(history).toMatchObject({
    ok: true,
    channel_id: "C123",
    messages: [
      { text: "hello" },
      { text: "hi there" },
    ],
  });

  const thread = ValueAdapter.cosmToJS(Cosm.Interpreter.eval(`
    require "lib/agent/slack_diag"
    Agent::SlackDiag.thread("C123", "1711.1")
  `));
  expect(thread).toMatchObject({
    ok: true,
    channel_id: "C123",
    thread_ts: "1711.1",
    messages: [
      { text: "hello" },
      { text: "hi there" },
    ],
  });

  slackApi.stop();
  cleanup();
});

test("slack service still accepts legacy COSM_* env aliases", async () => {
  const cleanup = withSlackEnv(true);
  const slackApi = installSlackApiHook();
  process.env.COSM_SLACK_API_URL = slackApi.url;

  CosmAiValue.installRuntimeHooks({
    chatCast: (_messages, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm({
      should_reply: true,
      text: "legacy alias reply",
      rationale: "mocked",
    })),
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    type: "event_callback",
    event_id: "Ev-legacy",
    event: {
      type: "message",
      channel_type: "im",
      channel: "D321",
      user: "U321",
      text: "hello from legacy",
      ts: "1710000030.000001",
    },
  });

  const response = dispatchSlack(body, timestamp);
  expect(ValueAdapter.cosmToJS(response.nativeProperty?.("status"))).toBe(200);
  expect(slackApi.calls).toHaveLength(1);

  slackApi.stop();
  cleanup();
});

import { afterEach, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

function withSlackEnv(useLegacyOnly = false) {
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
    cast: (prompt, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm(
      prompt.includes("Reset the session with the Reset Session button")
        ? {
            shouldReply: true,
            text: "You can also call Session.default().reset() from Cosm if you need to reset it in code.",
            rationale: "mocked follow-up",
            toolCalls: false,
            toolResults: false,
          }
        : {
            shouldReply: true,
            text: "Reset the session with the Reset Session button in the notebook UI.",
            rationale: "mocked",
            toolCalls: false,
            toolResults: false,
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
    cast: () => {
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
    cast: (_prompt, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm({
      shouldReply: true,
      text: "First reply in a durable DM thread.",
      rationale: "mocked initial",
      toolCalls: false,
      toolResults: false,
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

test("slack service reset clears only the current thread state", async () => {
  const cleanup = withSlackEnv();
  const slackApi = installSlackApiHook();
  process.env.SLACK_API_URL = slackApi.url;
  process.env.COSM_SLACK_API_URL = slackApi.url;

  CosmAiValue.installRuntimeHooks({
    cast: (_prompt, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm({
      shouldReply: true,
      text: "Fresh AI reply after reset.",
      rationale: "mocked",
      toolCalls: false,
      toolResults: false,
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
    slack: { signing_secret: true, bot_token: true, storage_writable: true },
    ai: { configured: true, health: true },
    agent: { name: "iapetus", mode: "single-turn" },
  });

  const status = dispatchService(serviceSource, "GET", "/status");
  expect(ValueAdapter.cosmToJS(status.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(String(ValueAdapter.cosmToJS(status.nativeProperty?.("body"))))).toMatchObject({
    ok: true,
    path: "/status",
    slack: { transport: "slack", dm_only: true },
    agent: { name: "iapetus", mode: "single-turn" },
  });

  slackApi.stop();
  cleanup();
});

test("slack service still accepts legacy COSM_* env aliases", async () => {
  const cleanup = withSlackEnv(true);
  const slackApi = installSlackApiHook();
  process.env.COSM_SLACK_API_URL = slackApi.url;

  CosmAiValue.installRuntimeHooks({
    cast: (_prompt, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm({
      shouldReply: true,
      text: "legacy alias reply",
      rationale: "mocked",
      toolCalls: false,
      toolResults: false,
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

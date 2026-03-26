import { afterEach, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AiRuntime } from "../src/runtime/AiRuntime";
import { ValueAdapter } from "../src/ValueAdapter";
import { CosmAiValue } from "../src/values/CosmAiValue";
import { CosmSlackValue } from "../src/values/CosmSlackValue";
import { dispatchService } from "./support/request_spec";

const originalSigningSecret = process.env.COSM_SLACK_SIGNING_SECRET;
const originalBotToken = process.env.COSM_SLACK_BOT_TOKEN;
const originalSlackInline = process.env.COSM_SLACK_INLINE_SESSION;
const originalSlackDir = process.env.COSM_SLACK_DIR;

const signBody = (body: string, secret: string, timestamp: string) => {
  const base = `v0:${timestamp}:${body}`;
  return `v0=${createHmac("sha256", secret).update(base).digest("hex")}`;
};

afterEach(() => {
  process.env.COSM_SLACK_SIGNING_SECRET = originalSigningSecret;
  process.env.COSM_SLACK_BOT_TOKEN = originalBotToken;
  process.env.COSM_SLACK_INLINE_SESSION = originalSlackInline;
  process.env.COSM_SLACK_DIR = originalSlackDir;
  CosmSlackValue.resetRegistry();
  CosmSlackValue.installRuntimeHooks({});
  CosmAiValue.installRuntimeHooks({
    status: () => AiRuntime.status(),
    complete: (prompt) => AiRuntime.complete(prompt),
    cast: (prompt, schema) => AiRuntime.cast(prompt, schema),
    compare: (left, right) => AiRuntime.compare(left, right),
  });
});

function withSlackEnv() {
  process.env.COSM_SLACK_SIGNING_SECRET = "signing-secret";
  process.env.COSM_SLACK_BOT_TOKEN = "xoxb-test";
  process.env.COSM_SLACK_INLINE_SESSION = "1";
  process.env.COSM_SLACK_DIR = mkdtempSync(join(tmpdir(), "cosm-slack-"));
  return () => {
    if (process.env.COSM_SLACK_DIR) {
      rmSync(process.env.COSM_SLACK_DIR, { recursive: true, force: true });
    }
  };
}

test("slack dm ingress verifies, reuses a session, and posts a structured reply", () => {
  const cleanup = withSlackEnv();

  const outboundCalls: Array<{ channel: string; text: string; thread_ts: string }> = [];
  CosmSlackValue.installRuntimeHooks({
    postMessage: (conversation, text) => {
      outboundCalls.push({
        channel: conversation.channel,
        text,
        thread_ts: conversation.thread,
      });
    },
  });

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
    event: {
      type: "message",
      channel_type: "im",
      channel: "D123",
      user: "U123",
      text: "How do I reset the session?",
      ts: "1710000000.000001",
    },
  });
  const signature = signBody(body, process.env.COSM_SLACK_SIGNING_SECRET!, timestamp);

  const response = dispatchService(`
    require("app/app.cosm")
    app.App.build()
  `, "POST", "/slack/events", {
    body,
    headers: {
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signature,
    },
  });

  expect(ValueAdapter.cosmToJS(response.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(String(ValueAdapter.cosmToJS(response.nativeProperty?.("body"))))).toMatchObject({ ok: true, replied: true });
  expect(outboundCalls).toEqual([
    {
      channel: "D123",
      text: "Reset the session with the Reset Session button in the notebook UI.",
      thread_ts: "1710000000.000001",
    },
  ]);

  const followUpBody = JSON.stringify({
    type: "event_callback",
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
  const followUpSignature = signBody(followUpBody, process.env.COSM_SLACK_SIGNING_SECRET!, timestamp);

  const followUpResponse = dispatchService(`
    require("app/app.cosm")
    app.App.build()
  `, "POST", "/slack/events", {
    body: followUpBody,
    headers: {
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": followUpSignature,
    },
  });

  expect(ValueAdapter.cosmToJS(followUpResponse.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(String(ValueAdapter.cosmToJS(followUpResponse.nativeProperty?.("body"))))).toMatchObject({ ok: true, replied: true });
  expect(outboundCalls).toEqual([
    {
      channel: "D123",
      text: "Reset the session with the Reset Session button in the notebook UI.",
      thread_ts: "1710000000.000001",
    },
    {
      channel: "D123",
      text: "You can also call Session.default().reset() from Cosm if you need to reset it in code.",
      thread_ts: "1710000000.000001",
    },
  ]);

  cleanup();
});

test("slack dm ingress shapes AI failures into a human-readable fallback reply", () => {
  const cleanup = withSlackEnv();

  const outboundCalls: Array<{ channel: string; text: string; thread_ts: string }> = [];
  CosmSlackValue.installRuntimeHooks({
    postMessage: (conversation, text) => {
      outboundCalls.push({
        channel: conversation.channel,
        text,
        thread_ts: conversation.thread,
      });
    },
  });

  CosmAiValue.installRuntimeHooks({
    cast: () => {
      throw new Error("AI backend is not configured for cast");
    },
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    type: "event_callback",
    event: {
      type: "message",
      channel_type: "im",
      channel: "D999",
      user: "U999",
      text: "Can you help me?",
      ts: "1710000002.000001",
    },
  });
  const signature = signBody(body, process.env.COSM_SLACK_SIGNING_SECRET!, timestamp);

  const response = dispatchService(`
    require("app/app.cosm")
    app.App.build()
  `, "POST", "/slack/events", {
    body,
    headers: {
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signature,
    },
  });

  expect(ValueAdapter.cosmToJS(response.nativeProperty?.("status"))).toBe(200);
  expect(JSON.parse(String(ValueAdapter.cosmToJS(response.nativeProperty?.("body"))))).toMatchObject({ ok: true, replied: true });
  expect(outboundCalls).toEqual([
    {
      channel: "D999",
      text: "I hit a support-agent hiccup while handling that DM. Please try again in a bit.",
      thread_ts: "1710000002.000001",
    },
  ]);

  cleanup();
});

test("slack dm conversations survive registry resets through the durable store", () => {
  const cleanup = withSlackEnv();

  const outboundCalls: Array<{ channel: string; text: string; thread_ts: string }> = [];
  CosmSlackValue.installRuntimeHooks({
    postMessage: (conversation, text) => {
      outboundCalls.push({
        channel: conversation.channel,
        text,
        thread_ts: conversation.thread,
      });
    },
  });

  CosmAiValue.installRuntimeHooks({
    cast: (prompt, schema) => schema.validateAndReturn(ValueAdapter.jsToCosm(
      prompt.includes("First question?")
        ? {
            shouldReply: true,
            text: "I still remember your first question in this DM thread.",
            rationale: "mocked persistence",
            toolCalls: false,
            toolResults: false,
          }
        : {
            shouldReply: true,
            text: "First reply in a durable DM thread.",
            rationale: "mocked initial",
            toolCalls: false,
            toolResults: false,
          },
    )),
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const firstBody = JSON.stringify({
    type: "event_callback",
    event: {
      type: "message",
      channel_type: "im",
      channel: "D777",
      user: "U777",
      text: "First question?",
      ts: "1710000010.000001",
    },
  });

  const firstResponse = dispatchService(`
    require("app/app.cosm")
    app.App.build()
  `, "POST", "/slack/events", {
    body: firstBody,
    headers: {
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signBody(firstBody, process.env.COSM_SLACK_SIGNING_SECRET!, timestamp),
    },
  });

  expect(ValueAdapter.cosmToJS(firstResponse.nativeProperty?.("status"))).toBe(200);
  CosmSlackValue.resetRegistry();

  const secondBody = JSON.stringify({
    type: "event_callback",
    event: {
      type: "message",
      channel_type: "im",
      channel: "D777",
      user: "U777",
      text: "Do you still remember it?",
      ts: "1710000011.000001",
      thread_ts: "1710000010.000001",
    },
  });

  const secondResponse = dispatchService(`
    require("app/app.cosm")
    app.App.build()
  `, "POST", "/slack/events", {
    body: secondBody,
    headers: {
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signBody(secondBody, process.env.COSM_SLACK_SIGNING_SECRET!, timestamp),
    },
  });

  expect(ValueAdapter.cosmToJS(secondResponse.nativeProperty?.("status"))).toBe(200);
  expect(outboundCalls.at(-1)).toEqual({
    channel: "D777",
    text: "I still remember your first question in this DM thread.",
    thread_ts: "1710000010.000001",
  });

  cleanup();
});

test("slack dm reset clears only the current thread state", () => {
  const cleanup = withSlackEnv();

  const outboundCalls: Array<{ channel: string; text: string; thread_ts: string }> = [];
  CosmSlackValue.installRuntimeHooks({
    postMessage: (conversation, text) => {
      outboundCalls.push({
        channel: conversation.channel,
        text,
        thread_ts: conversation.thread,
      });
    },
  });

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
    event: {
      type: "message",
      channel_type: "im",
      channel: "D555",
      user: "U555",
      text: "reset",
      ts: "1710000020.000001",
    },
  });

  const resetResponse = dispatchService(`
    require("app/app.cosm")
    app.App.build()
  `, "POST", "/slack/events", {
    body: resetBody,
    headers: {
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signBody(resetBody, process.env.COSM_SLACK_SIGNING_SECRET!, timestamp),
    },
  });

  expect(ValueAdapter.cosmToJS(resetResponse.nativeProperty?.("status"))).toBe(200);
  expect(outboundCalls.at(-1)).toEqual({
    channel: "D555",
    text: "Thread memory cleared. The next DM starts from a clean transcript and named session.",
    thread_ts: "1710000020.000001",
  });

  CosmSlackValue.resetRegistry();

  const followUpBody = JSON.stringify({
    type: "event_callback",
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

  const followUpResponse = dispatchService(`
    require("app/app.cosm")
    app.App.build()
  `, "POST", "/slack/events", {
    body: followUpBody,
    headers: {
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signBody(followUpBody, process.env.COSM_SLACK_SIGNING_SECRET!, timestamp),
    },
  });

  expect(ValueAdapter.cosmToJS(followUpResponse.nativeProperty?.("status"))).toBe(200);
  expect(outboundCalls.at(-1)).toEqual({
    channel: "D555",
    text: "Fresh AI reply after reset.",
    thread_ts: "1710000020.000001",
  });

  cleanup();
});

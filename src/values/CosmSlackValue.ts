import { execFileSync } from "node:child_process";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Construct } from "../Construct";
import { ValueAdapter } from "../ValueAdapter";
import { RuntimeValueManifest, manifestMethod } from "../runtime/RuntimeManifest";
import { CosmValue } from "../types";
import { CosmClassValue } from "./CosmClassValue";
import { CosmFunctionValue } from "./CosmFunctionValue";
import { CosmHttpRequestValue } from "./CosmHttpRequestValue";
import { CosmHttpResponseValue } from "./CosmHttpResponseValue";
import { CosmNamespaceValue } from "./CosmNamespaceValue";
import { CosmObjectValue } from "./CosmObjectValue";
import { CosmSessionValue } from "./CosmSessionValue";
import { CosmStringValue } from "./CosmStringValue";

type SlackInboundMessage = {
  channel: string;
  thread: string;
  user: string;
  text: string;
  ts: string;
};

type SlackConversationMessage = {
  role: "user" | "assistant";
  user?: string;
  text: string;
  ts?: string;
};

type SlackConversationState = {
  key: string;
  channel: string;
  thread: string;
  session: CosmSessionValue;
  messages: SlackConversationMessage[];
};

type SlackAgentReply = {
  shouldReply?: boolean;
  text?: string;
  rationale?: string | false;
};

export class CosmSlackValue extends CosmObjectValue {
  private static readonly conversations = new Map<string, SlackConversationState>();
  private static postMessageHandler?: (conversation: SlackConversationState, text: string) => void;

  static installRuntimeHooks(hooks: {
    postMessage?: (conversation: SlackConversationState, text: string) => void;
  }): void {
    this.postMessageHandler = hooks.postMessage;
  }

  static resetRegistry(): void {
    this.conversations.clear();
  }

  static readonly manifest: RuntimeValueManifest<CosmSlackValue> = {
    methods: {
      events: () => new CosmFunctionValue("events", (args, selfValue) => {
        if (!(selfValue instanceof CosmSlackValue)) {
          throw new Error("Type error: events expects a Slack receiver");
        }
        if (args.length < 1 || args.length > 2) {
          throw new Error(`Arity error: slack.events expects 1 or 2 arguments, got ${args.length}`);
        }
        const [requestValue, moduleValue] = args;
        if (!(requestValue instanceof CosmHttpRequestValue)) {
          throw new Error("Type error: slack.events expects an HttpRequest");
        }
        let modulePath = "support/agent.cosm";
        if (moduleValue !== undefined) {
          if (!(moduleValue instanceof CosmStringValue)) {
            throw new Error("Type error: slack.events expects a string module path when given");
          }
          modulePath = moduleValue.value;
        }
        return selfValue.handleEvents(requestValue, modulePath);
      }),
    },
  };

  constructor(
    fields: Record<string, CosmValue>,
    classRef?: CosmClassValue,
    private readonly responseClassRef?: CosmClassValue,
    private readonly namespaceClassRef?: CosmClassValue,
    private readonly sessionClassRef?: CosmClassValue,
    private readonly errorClassRef?: CosmClassValue,
  ) {
    super("Slack", fields, classRef);
  }

  override nativeMethod(name: string): CosmFunctionValue | undefined {
    const inherited = super.nativeMethod(name);
    if (inherited) {
      return inherited;
    }
    return manifestMethod(this, name, CosmSlackValue.manifest);
  }

  private handleEvents(request: CosmHttpRequestValue, modulePath: string): CosmHttpResponseValue {
    const signingSecret = process.env.COSM_SLACK_SIGNING_SECRET;
    if (!signingSecret) {
      return this.jsonResponse({ ok: false, error: "Slack signing secret is not configured" }, 500);
    }
    if (!this.verifyRequest(request, signingSecret)) {
      return this.jsonResponse({ ok: false, error: "Invalid Slack signature" }, 401);
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(request.bodyTextValue) as Record<string, unknown>;
    } catch {
      return this.jsonResponse({ ok: false, error: "Slack request body must be valid JSON" }, 400);
    }

    if (payload.type === "url_verification" && typeof payload.challenge === "string") {
      return this.jsonResponse({ challenge: payload.challenge }, 200);
    }

    const inbound = this.extractInboundMessage(payload);
    if (!inbound) {
      return this.jsonResponse({ ok: true, ignored: true }, 200);
    }

    const conversation = this.conversationFor(inbound);
    conversation.messages.push({
      role: "user",
      user: inbound.user,
      text: inbound.text,
      ts: inbound.ts,
    });

    const reply = this.resolveReply(conversation, inbound, modulePath);
    if (reply.shouldReply !== false) {
      conversation.messages.push({
        role: "assistant",
        text: reply.text,
      });
      this.postMessage(conversation, reply.text);
    }

    return this.jsonResponse({ ok: true, replied: reply.shouldReply !== false }, 200);
  }

  private resolveReply(
    conversation: SlackConversationState,
    inbound: SlackInboundMessage,
    modulePath: string,
  ): Required<Pick<SlackAgentReply, "text">> & Pick<SlackAgentReply, "shouldReply" | "rationale"> {
    const source = [
      `require(${JSON.stringify(modulePath)})`,
      `let conversation = ${this.cosmLiteral(this.conversationPayload(conversation))}`,
      `let inbound = ${this.cosmLiteral(inbound)}`,
      "agent.handle(conversation, inbound)",
    ].join("\n");
    const result = ValueAdapter.cosmToJS(conversation.session.tryEvalSource(source)) as Record<string, unknown>;
    if (result.ok === true && result.value && typeof result.value === "object" && !Array.isArray(result.value)) {
      const value = result.value as SlackAgentReply;
      if (typeof value.text === "string" && value.text.trim().length > 0) {
        return {
          shouldReply: value.shouldReply !== false,
          text: value.text,
          rationale: typeof value.rationale === "string" ? value.rationale : false,
        };
      }
    }

    const fallback = this.resolveFallbackReply(conversation, inbound, modulePath, result.error);
    if (fallback) {
      return fallback;
    }

    return {
      shouldReply: true,
      text: "I hit a support-agent hiccup while handling that DM. Please try again in a bit.",
      rationale: typeof result.inspect === "string" ? result.inspect : false,
    };
  }

  private resolveFallbackReply(
    conversation: SlackConversationState,
    inbound: SlackInboundMessage,
    modulePath: string,
    errorValue: unknown,
  ): (Required<Pick<SlackAgentReply, "text">> & Pick<SlackAgentReply, "shouldReply" | "rationale">) | false {
    const message = typeof errorValue === "object" && errorValue && !Array.isArray(errorValue)
      ? (errorValue as Record<string, unknown>).message
      : false;
    const errorMessage = typeof message === "string"
      ? message
      : "Support agent evaluation failed";
    const source = [
      `require(${JSON.stringify(modulePath)})`,
      `let conversation = ${this.cosmLiteral(this.conversationPayload(conversation))}`,
      `let inbound = ${this.cosmLiteral(inbound)}`,
      `agent.fallback(conversation, inbound, ${this.cosmLiteral(errorMessage)})`,
    ].join("\n");
    const result = ValueAdapter.cosmToJS(conversation.session.tryEvalSource(source)) as Record<string, unknown>;
    if (result.ok !== true || !result.value || typeof result.value !== "object" || Array.isArray(result.value)) {
      return false;
    }
    const value = result.value as SlackAgentReply;
    if (typeof value.text !== "string" || value.text.trim().length === 0) {
      return false;
    }
    return {
      shouldReply: value.shouldReply !== false,
      text: value.text,
      rationale: typeof value.rationale === "string" ? value.rationale : false,
    };
  }

  private postMessage(conversation: SlackConversationState, text: string): void {
    if (CosmSlackValue.postMessageHandler) {
      CosmSlackValue.postMessageHandler(conversation, text);
      return;
    }
    const botToken = process.env.COSM_SLACK_BOT_TOKEN;
    if (!botToken) {
      throw new Error("Slack bot token is not configured");
    }
    const payload = {
      channel: conversation.channel,
      text,
      thread_ts: conversation.thread,
    };
    const raw = execFileSync("curl", [
      "-sS",
      "-X",
      "POST",
      "https://slack.com/api/chat.postMessage",
      "-H",
      `Authorization: Bearer ${botToken}`,
      "-H",
      "Content-Type: application/json; charset=utf-8",
      "-d",
      JSON.stringify(payload),
    ], {
      encoding: "utf8",
      maxBuffer: 5 * 1024 * 1024,
    });
    const parsed = JSON.parse(raw) as { ok?: boolean; error?: string };
    if (!parsed.ok) {
      throw new Error(`Slack API error: ${parsed.error ?? "unknown_error"}`);
    }
  }

  private verifyRequest(request: CosmHttpRequestValue, signingSecret: string): boolean {
    const timestamp = this.headerValue(request, "x-slack-request-timestamp");
    const signature = this.headerValue(request, "x-slack-signature");
    if (!timestamp || !signature) {
      return false;
    }
    const timestampNumber = Number(timestamp);
    if (!Number.isFinite(timestampNumber) || Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > 60 * 5) {
      return false;
    }
    const base = `v0:${timestamp}:${request.bodyTextValue}`;
    const expected = `v0=${createHmac("sha256", signingSecret).update(base).digest("hex")}`;
    const actualBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(actualBuffer, expectedBuffer);
  }

  private headerValue(request: CosmHttpRequestValue, name: string): string | undefined {
    const entry = request.headers.fields[name.toLowerCase()];
    return entry instanceof CosmStringValue ? entry.value : undefined;
  }

  private extractInboundMessage(payload: Record<string, unknown>): SlackInboundMessage | false {
    if (payload.type !== "event_callback") {
      return false;
    }
    const event = payload.event;
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      return false;
    }
    const record = event as Record<string, unknown>;
    if (record.type !== "message" || record.channel_type !== "im") {
      return false;
    }
    if (typeof record.text !== "string" || typeof record.user !== "string" || typeof record.channel !== "string" || typeof record.ts !== "string") {
      return false;
    }
    if (typeof record.bot_id === "string" || typeof record.subtype === "string") {
      return false;
    }
    return {
      channel: record.channel,
      thread: typeof record.thread_ts === "string" ? record.thread_ts : record.ts,
      user: record.user,
      text: record.text,
      ts: record.ts,
    };
  }

  private conversationFor(inbound: SlackInboundMessage): SlackConversationState {
    const key = `${inbound.channel}:${inbound.thread}`;
    const existing = CosmSlackValue.conversations.get(key);
    if (existing) {
      return existing;
    }
    const session = new CosmSessionValue(
      `slack-${CosmSlackValue.conversations.size + 1}`,
      this.sessionClassRef,
      this.errorClassRef,
    );
    const conversation: SlackConversationState = {
      key,
      channel: inbound.channel,
      thread: inbound.thread,
      session,
      messages: [],
    };
    CosmSlackValue.conversations.set(key, conversation);
    return conversation;
  }

  private conversationPayload(conversation: SlackConversationState): Record<string, unknown> {
    return {
      key: conversation.key,
      channel: conversation.channel,
      thread: conversation.thread,
      messages: conversation.messages,
      sessionName: conversation.session.sessionName,
      sessionLength: ValueAdapter.cosmToJS(conversation.session.nativeProperty("length") ?? Construct.number(0)),
    };
  }

  private cosmLiteral(value: unknown): string {
    if (value === null || value === false) {
      return "false";
    }
    if (value === true) {
      return "true";
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? String(value) : JSON.stringify(String(value));
    }
    if (typeof value === "string") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.cosmLiteral(entry)).join(", ")}]`;
    }
    if (typeof value === "object" && value) {
      return `{ ${Object.entries(value)
        .map(([key, entry]) => `${key}: ${this.cosmLiteral(entry)}`)
        .join(", ")} }`;
    }
    return JSON.stringify(String(value));
  }

  private jsonResponse(value: Record<string, unknown>, status: number): CosmHttpResponseValue {
    return new CosmHttpResponseValue(
      status,
      new CosmStringValue(JSON.stringify(value)),
      new CosmNamespaceValue({ "content-type": new CosmStringValue("application/json") }, this.namespaceClassRef),
      this.responseClassRef,
    );
  }
}

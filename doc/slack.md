# Slack DM Agent

The Slack wedge is intentionally narrow in `0.3.13.11`:

- DM-only
- conversational only
- one reply per accepted inbound message
- durable per-thread local memory
- no tool use, no staged workflow engine, no channel-wide behavior

## Service Shape

- [agent/service.cosm](/Users/joe/Work/cosm-lang/agent/service.cosm) defines the service object and routes
- [agent/server.cosm](/Users/joe/Work/cosm-lang/agent/server.cosm) is the simple boot entry
- [agent/runtime.cosm](/Users/joe/Work/cosm-lang/agent/runtime.cosm) owns the persistent agent turn loop, named-session policy, and conversation mutation
- [agent/slack.cosm](/Users/joe/Work/cosm-lang/agent/slack.cosm) owns Slack verification, DM filtering, dedupe, and request normalization
- [agent/store.cosm](/Users/joe/Work/cosm-lang/agent/store.cosm) owns file-backed thread storage
- [agent/slack_dm.cosm](/Users/joe/Work/cosm-lang/agent/slack_dm.cosm) owns the one-shot DM smoke command

## Minimum Setup

To send one outbound DM with the smoke helper, you only need:

- `SLACK_BOT_TOKEN`

To receive inbound Slack events at `/slack/events`, you additionally need:

- `SLACK_SIGNING_SECRET`

Everything else is optional for the basic testing loop.

## Full Env Surface

- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN`
- `SLACK_APP_ID` optional, for status/docs clarity only
- `SLACK_CLIENT_ID` optional, for status/docs clarity only
- `SLACK_CLIENT_SECRET` optional, for status/docs clarity only
- `SLACK_STORAGE_DIR` optional, defaults to `var/slack/threads`
- `SLACK_API_URL` optional, defaults to `https://slack.com/api/chat.postMessage`
- `AGENT_PORT` optional, defaults to `12456`
- compatibility aliases remain for one patch line: `COSM_SLACK_SIGNING_SECRET`, `COSM_SLACK_BOT_TOKEN`, `COSM_SLACK_DIR`, `COSM_SLACK_API_URL`, and `COSM_AGENT_PORT`
- normal AI env such as `COSM_AI_BACKEND`, `COSM_AI_BASE_URL`, and optionally `COSM_AI_MODEL`

`SLACK_SIGNING_SECRET` is the Slack app's request signing secret used to verify inbound webhook deliveries. It is not the bot token and not the app id.

For practical setup:

- `SLACK_BOT_TOKEN` is enough for the one-shot outbound DM smoke tool
- `SLACK_SIGNING_SECRET` is additionally required for inbound `/slack/events` verification
- `SLACK_APP_ID`, `SLACK_CLIENT_ID`, and `SLACK_CLIENT_SECRET` belong to app/OAuth administration and are not required for the basic DM send/verify loop

## Fastest Test Loop

If you just want to prove the bot token works before touching inbound events:

1. Export `SLACK_BOT_TOKEN`.
2. Find a Slack DM conversation id like `D01234567`.
3. Run `./script/bunx bin/cosm agent/send_dm.cosm D01234567 "hello from Cosm"`.
4. Confirm you see:
   - `ok`
   - `channel_id: D...`
   - `ts: ...`

In the smoke command, `channel_id` means a Slack conversation/channel id, not a username, email, or app id.

For DMs, this is usually a `D...` id.

## Manual DM-Only Checklist

1. Export `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET`.
2. Start the separate service with `./script/bunx bin/cosm agent/server.cosm`.
3. Check `GET /health` for process liveness.
4. Check `GET /ready` and confirm Slack env, storage, AI config, and AI health all report ready.
5. Run `./script/bunx bin/cosm agent/send_dm.cosm <channel_id> "<text>"` to verify outbound auth and posting before testing inbound events.
6. Complete Slack URL verification against `POST /slack/events`.
7. Send a first DM and confirm exactly one reply appears.
8. Send a follow-up in the same DM thread and confirm context is reused.
9. Replay the same Slack delivery and confirm it dedupes without a second reply.
10. Send `help`, `status`, and `reset` and confirm each behaves cleanly.
11. Restart the service and confirm the same DM thread still reuses transcript/session state.
12. Simulate backend unavailability and confirm the user gets a readable fallback reply rather than silence.

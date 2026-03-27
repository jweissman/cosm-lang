# Slack Agent

The Slack wedge is intentionally narrow and runtime-centered:

- DM plus mention-driven channel threads
- webhook-driven
- conversational only
- one reply per accepted inbound message
- durable per-thread structured message memory
- no tool use, no staged workflow engine, no channel-wide behavior

## Service Shape

- [service.cosm](/Users/joe/Work/cosm-lang/lib/agent/service.cosm) defines the service object and routes
- [server.cosm](/Users/joe/Work/cosm-lang/lib/agent/server.cosm) is the canonical live service entry
- [runtime.cosm](/Users/joe/Work/cosm-lang/lib/agent/runtime.cosm) owns the persistent agent turn loop, named-session policy, conversation mutation, and runtime status
- [slack.cosm](/Users/joe/Work/cosm-lang/lib/agent/slack.cosm) owns Slack verification, DM/mention filtering, dedupe, and request normalization
- [store.cosm](/Users/joe/Work/cosm-lang/lib/agent/store.cosm) owns file-backed thread storage
- [chat.cosm](/Users/joe/Work/cosm-lang/lib/agent/chat.cosm) owns the local terminal chat loop over the same runtime/store path
- [slack_dm.cosm](/Users/joe/Work/cosm-lang/lib/agent/slack_dm.cosm) owns the one-shot DM smoke command
- [slack_diag.cosm](/Users/joe/Work/cosm-lang/lib/agent/slack_diag.cosm) owns narrow read-only Slack diagnostics

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
- `SLACK_ALLOWED_CHANNELS` optional, comma-separated Slack channel ids for mention-driven channel ingress
- `AGENT_PORT` optional, defaults to `12456`
- compatibility aliases remain for one patch line: `COSM_SLACK_SIGNING_SECRET`, `COSM_SLACK_BOT_TOKEN`, `COSM_SLACK_DIR`, `COSM_SLACK_API_URL`, and `COSM_AGENT_PORT`
- normal AI env such as `COSM_AI_BACKEND`, `COSM_AI_BASE_URL`, and optionally `COSM_AI_MODEL`
- requiring `cosm/dotenv` loads `.env`, then `.env.local`, while keeping already-exported shell env authoritative

`SLACK_SIGNING_SECRET` is the Slack app's request signing secret used to verify inbound webhook deliveries. It is not the bot token and not the app id.

For practical setup:

- `SLACK_BOT_TOKEN` is enough for the one-shot outbound DM smoke tool
- `SLACK_SIGNING_SECRET` is additionally required for inbound `/slack/events` verification
- `SLACK_ALLOWED_CHANNELS` enables mention-driven channel ingress for those channel ids only
- mention-driven channels require the `app_mention` event plus the `app_mentions:read` scope
- `SLACK_APP_ID`, `SLACK_CLIENT_ID`, and `SLACK_CLIENT_SECRET` belong to app/OAuth administration and are not required for the basic DM send/verify loop
- if you add new scopes, reinstall the Slack app before expecting them to take effect

## Fastest Test Loop

If you just want to prove the bot token works before touching inbound events:

1. Export `SLACK_BOT_TOKEN`.
2. Find a Slack DM conversation id like `D01234567`.
3. Run `./script/bunx bin/cosm lib/agent/send_dm.cosm D01234567 "hello from Cosm"`.
4. Confirm you see:
   - `ok`
   - `channel_id: D...`
   - `ts: ...`

In the smoke command, `channel_id` means a Slack conversation/channel id, not a username, email, or app id.

For DMs, this is usually a `D...` id.

## Manual Checklist

1. Export `SLACK_BOT_TOKEN` and `SLACK_SIGNING_SECRET`.
2. If you want channel mentions, also export `SLACK_ALLOWED_CHANNELS=<id1,id2,...>`.
3. Start the separate service with `./script/bunx bin/cosm lib/agent/server.cosm` or `just agent-server`.
   It does not take a channel id. Slack delivers DM events to `POST /slack/events`, and the service logs accepted, ignored, deduped, and replied events as they happen.
4. Check `GET /health` for process liveness.
5. Check `GET /ready` and confirm Slack env, ingress mode, storage, AI config, and AI health all report ready.
6. Check `GET /status` and confirm recent runtime activity is visible.
7. Run `./script/bunx bin/cosm agent slack:status` and `./script/bunx bin/cosm agent slack:channels` so you can see what the bot token can currently access.
   `./script/bunx bin/cosm agent slack:history <channel_id>` and `./script/bunx bin/cosm agent slack:thread <channel_id> <thread_ts>` are the narrow read-only message/thread inspection surfaces when debugging.
8. Optionally run `just chat` to verify the same runtime/store loop locally before touching Slack. Inside local chat, `prompt`, `preview`, and `runtime` are local-only inspection helpers for prompt iteration. `preview` now shows the real message list sent to the model rather than a stitched transcript prompt.
9. Run `./script/bunx bin/cosm lib/agent/send_dm.cosm <channel_id> "<text>"` to verify outbound auth and posting before testing inbound events.
10. Complete Slack URL verification against `POST /slack/events`.
11. Send a first DM and confirm exactly one reply appears.
12. Mention the bot in an allowed channel and confirm it replies in-thread.
13. Send a follow-up in that same thread without another mention and confirm context is reused.
14. Replay the same Slack delivery and confirm it dedupes without a second reply.
15. Send `help`, `status`, and `reset` and confirm each behaves cleanly.
16. Restart the service and confirm the same DM or channel thread still reuses structured message/session state.
17. Simulate backend unavailability and confirm the user gets a readable fallback reply rather than silence.

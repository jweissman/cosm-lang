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

## Required Env

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

## Manual DM-Only Checklist

1. Start the separate service with `./script/bunx bin/cosm agent/server.cosm`.
2. Check `GET /health` for process liveness.
3. Check `GET /ready` and confirm Slack env, storage, AI config, and AI health all report ready.
4. Run `./script/bunx bin/cosm agent/send_dm.cosm <target> "<text>"` to verify outbound auth and posting before testing inbound events.
5. Complete Slack URL verification against `POST /slack/events`.
6. Send a first DM and confirm exactly one reply appears.
7. Send a follow-up in the same DM thread and confirm context is reused.
8. Replay the same Slack delivery and confirm it dedupes without a second reply.
9. Send `help`, `status`, and `reset` and confirm each behaves cleanly.
10. Restart the service and confirm the same DM thread still reuses transcript/session state.
11. Simulate backend unavailability and confirm the user gets a readable fallback reply rather than silence.

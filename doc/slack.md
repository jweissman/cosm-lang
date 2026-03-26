# Slack DM Agent

The Slack wedge is intentionally narrow in `0.3.13.9`:

- DM-only
- conversational only
- one reply per accepted inbound message
- durable per-thread local memory
- no tool use, no staged workflow engine, no channel-wide behavior

## Service Shape

- [agent/service.cosm](/Users/joe/Work/cosm-lang/agent/service.cosm) defines the service object and routes
- [agent/server.cosm](/Users/joe/Work/cosm-lang/agent/server.cosm) is the simple boot entry
- [agent/slack.cosm](/Users/joe/Work/cosm-lang/agent/slack.cosm) owns verification, DM filtering, dedupe, persistence, and outbound posting
- [agent/slack_store.cosm](/Users/joe/Work/cosm-lang/agent/slack_store.cosm) owns file-backed thread storage

## Required Env

- `COSM_SLACK_SIGNING_SECRET`
- `COSM_SLACK_BOT_TOKEN`
- `COSM_SLACK_DIR` optional, defaults to `var/slack/threads`
- `COSM_SLACK_API_URL` optional, defaults to `https://slack.com/api/chat.postMessage`
- normal AI env such as `COSM_AI_BACKEND`, `COSM_AI_BASE_URL`, and optionally `COSM_AI_MODEL`

## Manual DM-Only Checklist

1. Start the separate service with `./script/bunx bin/cosm agent/server.cosm`.
2. Check `GET /health` for process liveness.
3. Check `GET /ready` and confirm Slack env, storage, AI config, and AI health all report ready.
4. Complete Slack URL verification against `POST /slack/events`.
5. Send a first DM and confirm exactly one reply appears.
6. Send a follow-up in the same DM thread and confirm context is reused.
7. Replay the same Slack delivery and confirm it dedupes without a second reply.
8. Send `help`, `status`, and `reset` and confirm each behaves cleanly.
9. Restart the service and confirm the same DM thread still reuses transcript/session state.
10. Simulate backend unavailability and confirm the user gets a readable fallback reply rather than silence.

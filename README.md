# cosm-lang

Cosm is a small reflective programming language for interactive tooling, service objects, and explicit runtime boundaries.

It is designed to stay legible about classes, message send, modules, validation, and host interop instead of hiding them behind framework magic. The current tree includes the language runtime, a small standard-library layer written in Cosm, a notebook-first app wedge for learning and experimentation, narrower separate assistant and Slack-facing agent wedges, and a more explicit boundary story around `Mirror`, `Hologram`, and `Cosm::AI`.

## What Cosm Emphasizes

- reflective classes, metaclasses, modules, and message send
- an explicit `BasicObject` / `Object` / `Module` / `Class` tower with authored Cosm core facades
- explicit runtime roots like `Kernel`, `Process`, `Time`, `Random`, `Schema`, and `Data`
- constant-backed modules loaded with `require "path"` and accessed through `::`
- object-first services through `HttpRouter`, `HttpRequest`, and `HttpResponse`
- a narrow but real block story through trailing `do ... end`, `yield(...)`, and block-native collection sends
- structured validation and AI boundaries through `Schema`, `Data`, `Prompt`, and `Cosm::AI`
- explicit readonly/writable boundary seams through `Mirror` and `Cosm::Hologram`

## A Few Examples

```cosm
class Pair
  def init(left, right)
    @left = left
    @right = right
  end

  def sum = @left + @right
end

let pair = Pair.new(1, 2)
pair.sum()
```

```cosm
suite("math") do
  it("adds") do
    expect(2 + 2).to_eql(4)
  end
end
```

```cosm
require "cosm/ai"

Ticket = Data.model("Ticket", {
  title: Data.string(),
  priority: Data.enum("low", "high")
}, {
  priority: "low"
})

Ticket.build({ title: "Demo" })
Cosm::AI.cast(Prompt.text("title: Demo, priority: high"), Ticket)
```

```cosm
class App
  class << self
    def build()
      router = HttpRouter.new()
      router.draw do
        get "/health" do |req|
          HttpResponse.json({ ok: true, path: req.path }, 200)
        end
      end
      App.new(router)
    end
  end

  def init(router) true end

  def handle(req)
    @router.handle(req)
  end
end
```

## Project Shape

- `src/` contains the TS runtime, parser, interpreter, and VM seams
- `examples/` contains the canonical executable Cosm example corpus
- `cosm/` contains Cosm-authored stdlib-ish helpers
- `spec/` contains Cosm-native language/runtime specs
- `test/` contains Bun tests for parser/runtime/CLI/integration behavior
- `test/fixtures/vm/` contains interpreter/VM parity smoke programs for the supported VM subset
- `lib/` contains project-local Cosm-authored modules, including `lib/app/`, `lib/agent/`, and `lib/support/`

## Development

Common commands:

- `./script/bunx run test:fast`
- `./script/bunx run test:slow`
- `./script/bunx run test:live-ai`
- `./script/bunx run lint`
- `./script/bunx bin/cosm test`
- `./script/bunx bin/cosm test spec/`
- `./script/bunx bin/cosm test spec/examples/`
- `./script/bunx bin/cosm test test/`
- `./script/bunx bin/agent slack:status`
- `./script/bunx bin/agent slack:channels`
- `./script/bunx bin/agent slack:thread <channel_id> <thread_ts>`
- `./script/bunx bin/cosm test spec/runtime/baseline.cosm`
- `./script/bunx bin/cosm --version`
- `./script/bunx bin/cosm -e '1 + 2'`

`just` shortcuts:

- `just test`
- `just slow-test`
- `just watch-test`
- `just server`
- `just agent-server`
- `just chat`
- `just send-dm <channel_id> <text>`
- `just self-test`

Notebook workflow:

- `just server` starts the notebook-first app wedge
- `/notebook` is the current flagship surface for learning the language and exploring the runtime
- notebook pages are durable local block documents with one named session per page
- notebook examples focus on the object protocol, core tower, collection lattice, and explicit runtime objects

Iapetus workflow:

- `just agent-server` starts the Slack-facing service at the canonical `lib/agent/server.cosm` entrypoint
- `just chat` starts the local terminal loop against the same `Agent::Runtime` and file-backed store
- `/assistant` remains available as a narrower page-backed wedge, but it is no longer presented as co-equal with the notebook workbench
- maintained agent entrypoints explicitly `require "cosm/dotenv"` so `.env` and `.env.local` are loaded on startup without ambient CLI magic
- `agent-server` is webhook-driven, not channel-polling: it does not take a channel id, and Slack delivers accepted DM and mention-driven channel events to `POST /slack/events`
- inside local chat, `prompt`, `preview`, and `runtime` expose the current system prompt, the real message list that will be sent to the model, and local runtime/session status
- `/ready`, `/status`, and `/agent/status` make the runtime/storage/AI state inspectable before you DM or mention it, including recent activity summaries
- `agent slack:status`, `slack:channels`, `slack:history <channel_id>`, and `slack:thread <channel_id> <thread_ts>` provide narrow read-only Slack diagnostics

Slack smoke testing:

- outbound post only needs `SLACK_BOT_TOKEN`
- inbound `/slack/events` verification also needs `SLACK_SIGNING_SECRET`
- allowed channel mentions use `SLACK_ALLOWED_CHANNELS=<id1,id2,...>`
- mention-driven channels also need the Slack `app_mention` event plus `app_mentions:read`
- the one-shot send helper accepts a Slack conversation id such as `D...`, `C...`, or `G...`
- the current agent service and local chat loop both reuse the same durable runtime/store path and structured message history
- current durable wedge state is file-backed under `var/` unless you override the storage env vars

## Docs

- [Language reference](./doc/lang.md)
- [Feature snapshot](./doc/features.md)
- [HTTP boundary notes](./doc/http_boundaries.md)
- [Roadmap](./doc/roadmap.md)
- [Runtime call flow](./doc/runtime_call_flow.md)
- [Slack agent notes](./doc/slack.md)
- [Vision](./doc/vision.md)

## Current Boundaries

Cosm is intentionally still narrow in a few places:

- no keyword args or call-site spread yet
- no `ensure` or typed `rescue` matching yet; `begin ... rescue err ... end` is now the narrow first structured error path
- no browser-side runtime
- no generalized tool runtime or multi-agent platform
- no full JS interop bridge yet
- `Mirror` is the readonly reflective/view boundary, and `Cosm::Hologram` is the intended read/write capability-wrapping interop seam; the current proof path now includes a Bun-backed HTTP object while the current `HttpRequest` / `HttpResponse` layer remains transitional
- no fully general VM execution yet; `--vm` is still experimental and currently targets a documented supported corridor plus a small parity corpus under `examples/spec/` and `test/fixtures/vm/`

That narrowness is deliberate: the project is still pushing more behavior into Cosm while keeping the runtime surface explicit and inspectable.

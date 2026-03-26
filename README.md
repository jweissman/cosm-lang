# cosm-lang

Cosm is a small reflective programming language for interactive tooling, service objects, and explicit runtime boundaries.

It is designed to stay legible about classes, message send, modules, validation, and host interop instead of hiding them behind framework magic. The current tree includes the language runtime, a small standard-library layer written in Cosm, a notebook-style app wedge, and a separate Slack-facing agent service.

## What Cosm Emphasizes

- reflective classes, metaclasses, modules, and message send
- explicit runtime roots like `Kernel`, `Process`, `Time`, `Random`, `Schema`, and `Data`
- constant-backed modules loaded with `require "path"` and accessed through `::`
- object-first services through `HttpRouter`, `HttpRequest`, and `HttpResponse`
- a narrow but real block story through trailing `do ... end` and `yield(...)`
- structured validation and AI boundaries through `Schema`, `Data`, `Prompt`, and `Cosm::AI`

## A Few Examples

```cosm
class Pair
  def init(left, right) true end
  def sum() @left + @right end
end

pair = Pair.new(1, 2)
pair.sum()
```

```cosm
suite("math", ->() {
  it("adds", ->() {
    assert_equal(2 + 2, 4)
  })
})
```

```cosm
require "cosm/ai"

Ticket = Data.model("Ticket", {
  title: Data.string(),
  priority: Data.enum("low", "high")
})

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
- `cosm/` contains Cosm-authored stdlib-ish helpers
- `spec/` contains Cosm-native language/runtime specs
- `test/` contains Bun tests for parser/runtime/CLI/integration behavior
- `lib/` contains project-local Cosm-authored modules, including `lib/app/`, `lib/agent/`, and `lib/support/`

## Development

Common commands:

- `./script/bunx run test:fast`
- `./script/bunx run test:slow`
- `./script/bunx run test:live-ai`
- `./script/bunx run lint`
- `./script/bunx bin/cosm test`
- `./script/bunx bin/cosm test spec/core.cosm`
- `./script/bunx bin/cosm test spec/`
- `./script/bunx bin/cosm test test/`
- `./script/bunx bin/cosm spec/core.cosm`
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

Iapetus workflow:

- `just agent-server` starts the DM-first Slack-facing service at the canonical `lib/agent/server.cosm` entrypoint
- `just chat` starts the local terminal loop against the same `Agent::Runtime` and file-backed store
- `/ready`, `/status`, and `/agent/status` make the runtime/storage/AI state inspectable before you DM it

Slack smoke testing:

- outbound post only needs `SLACK_BOT_TOKEN`
- inbound `/slack/events` verification also needs `SLACK_SIGNING_SECRET`
- the one-shot DM helper expects a Slack conversation id such as `D...`
- the current agent service and local chat loop both reuse the same durable runtime/store path

## Docs

- [Language reference](./doc/lang.md)
- [Feature snapshot](./doc/features.md)
- [Roadmap](./doc/roadmap.md)
- [Slack agent notes](./doc/slack.md)
- [Vision](./doc/vision.md)

## Current Boundaries

Cosm is intentionally still narrow in a few places:

- no keyword args or call-site spread yet
- no rescue/ensure exception system yet
- no browser-side runtime
- no generalized tool runtime or multi-agent platform
- no full JS interop bridge yet
- no fully general VM execution yet; `--vm` is still experimental and mainly for narrow parity checks

That narrowness is deliberate: the project is still pushing more behavior into Cosm while keeping the runtime surface explicit and inspectable.

# cosm-lang

Cosm is a small reflective programming language built on top of the JS runtime.

## Current Focus

The current tree is best read as **`0.3.12`**: it is using the shared support-assistant core to pressure the language/runtime itself, especially message-passing seams, first-class runtime include, explicit AI streaming, and a more Cosm-owned spec/harness surface:

- reflective classes, metaclasses, and method lookup
- a tiny router/service story through `HttpRouter`
- router-level middleware through `HttpRouter.use(...)`
- trailing `do ... end` block passing with block params on calls
- real narrow `yield(...)` for invoking the current implicit trailing block
- `Kernel.blockGiven()` for the current trailing-block context
- HTML-friendly responses through `HttpResponse.html(...)`
- first-class `inspect()` and `to_s()` behavior across the runtime
- `.ecosm` templates for real app views under `app/views/...`, now aligned with narrow `yield()`-based layout composition without smuggling body content through ordinary context keys
- the first readonly reflective primitive through `Mirror.reflect(...)`
- a clearer class-side authoring path through `class << self`
- split view modules for app rendering
- explicit `Session` runtime objects for notebook/server eval
- explicit `Prompt`, `Schema`, and `cosm.ai` surfaces, with LM Studio as the default local backend path
- a library-first `Data` module and `Data.Model` runtime layer on top of `Schema`
- a first Cosm-authored stdlib wrapper through `require("cosm/ai.cosm")`
- universal receiver-side `methods()` reflection as a symbol-list surface, with `method(:name)` for concrete lookup
- `Kernel.dispatch(receiver, message, ...)` as the explicit helper-form dispatch API alongside `receiver.send(...)`
- small tie-your-shoes helpers like `Kernel.uuid()`, `Kernel.tryValidate(...)`, `Kernel.trace(...)`, `Kernel.readline(...)`, and `Random.choice(...)`
- local schema/model work taught as validation-only, while `cast(...)` stays the AI-shaped term through `cosm.ai.cast(...)`
- preferred `<%= ... %>` interpolation for `.ecosm`, while keeping `#{...}` working for compatibility
- a cleaner notebook workbench with Cosm-inspected output, debounced live eval, a secondary examples section, and browser-local recent snippets
- a small Cosm-authored examples module for the notebook through `require("app/examples.cosm")`
- a narrow VM-oriented IR plus `--trace-ir` / `--vm` CLI surfaces for a supported subset
- a tiny DM-first Slack support path through `/slack/events`, `slack.events(req)`, and Cosm-authored `support/` modules
- a pure Cosm support-chat core through `require("support/chat.cosm")` and a CLI entrypoint at `support/chat_cli.cosm`, with that CLI loop now acting as the canonical proving surface and Slack reusing the same support modules as a thin adapter
- a first runtime-backed `include(...)` surface on classes through reflective module objects
- an explicit `cosm.ai.stream(...)` / `require("cosm/ai.cosm").stream(...)` API for callback-based AI output
- a streamed chat CLI path with a small wait-state message before the first chunk arrives
- an incremental Cosm-owned harness layer through `require("cosm/spec.cosm")`

This is intentionally still below a full notebook product or framework layer. `0.3.12` is a PL-core hardening slice: clearer ownership between `Schema` / `Data` / `cosm.ai`, a smaller interpreter semantic surface, a more credible send-first VM path, a support-assistant core written in Cosm, and a notebook that teaches those layers without pretending to be the next product yet.

Explicitly not in `0.3.11`:
- ampersand block capture or forwarding
- browser-side Cosm runtime
- MCP, broad tool ecosystems, or generalized persistent multi-agent runtime surfaces
- `data Foo ... end` syntax or model-declaration syntax
- notebook persistence or multi-user isolation
- Tailwind or any frontend styling stack as a language/runtime commitment
- broader route DSL syntax or router macros
- HTML tag-builder DSLs
- JS interop mirrors/holograms
- full VM execution

In `0.3.11`, `yield(...)` remains a real but narrow language/runtime feature. It only invokes the current implicit trailing block; there is still no `&block`, block forwarding, or broader Ruby-style block object model.

The current dev-loop step is a small `--watch` mode for long-running entry files. It restarts a file from scratch when that file changes; it is not in-process hot reload. The CLI now also treats `--help`, unknown switches, and trailing `--watch` more deliberately.

Small services in `0.3.11` should now be organized as:

- a boot entry like `app/server.cosm`
- an app/service module like `app/app.cosm`
- one or more view modules like `app/views/index.cosm`
- page/layout/fragment templates under `app/views/...`
- object-first service classes that still own `handle(req)` and router setup

## Current Examples

```cosm
class Pair do
  def init(left, right) true end
  def sum() @left + @right end
end

let pair = Pair.new(1, 2)
pair.sum()
```

```cosm
Kernel.inspect(classes.Pair)
Kernel.dispatch(1, :plus, 2)
"42".to_i()
Kernel.tryValidate(42, Schema.number())
```

```cosm
require("cosm/test")
describe("math", ->() {
  test("addition", ->() { assert(2 + 2 == 4) })
})
```

```cosm
class Builder
  def does_not_understand(message, args)
    message.name + ":" + args.length
  end
  def render()
    wrapper("ok")
  end
end

Builder.new().render()
```

```cosm
require("app/app.cosm")
let server = http.serve(3001, app.App.build())
```

```cosm
class App
  class << self
    def build()
      let router = HttpRouter.new()
      router.use do |req, next|
        App.log(req)
        next()
      end
      router.draw do
        get "/" do |req|
          HttpResponse.html("""<h1>Hello #{req.path}</h1>""", 200)
        end
      end
      App.new(router)
    end
  end

  def init(router)
    true
  end

  def handle(req)
    @router.handle(req)
  end
end
```

Trailing `do ... end` on calls is still intentionally narrow in `0.3.11`: it is block/lambda sugar, not a full Ruby block system. The useful current step is block params on trailing blocks plus real `yield(...)`, so service code can now use:

```cosm
router.draw do
  get "/" do |req|
    HttpResponse.html("<h1>Hello</h1>", 200)
  end
end
```

```cosm
def around(value)
  yield(value + 1)
end

around(41) do |number|
  number
end
```

The demo app now also exposes a small `/notebook` page plus a live-ish `/notebook/eval` endpoint with handwritten fetch-based updates, debounced live evaluation, one-click examples, browser-local recent snippets, server-side evaluation, and one explicit default session per running process. In `0.3.11`, that session still evaluates through a worker-backed isolation boundary with timeout/error wrapping, and the notebook now actively demonstrates simplified receiver reflection, `Kernel.dispatch(...)`, `Kernel.tryValidate(...)`, explicit scalar casts like `to_i()` / `to_f()`, validation through `Schema` / `Data`, explicit `cosm.ai.cast(...)`, `require("app/examples.cosm")`, and a tiny support-agent prompt path through `require("support/agent.cosm")`.

The canonical app also now exposes a narrow Slack ingress at `/slack/events`. Verification, session/thread mapping, and outbound posting stay TS-owned, while prompt assembly, reply shaping, and model definitions live in Cosm under `support/`.

You can also talk to the pure Cosm support loop directly:

- `bun bin/cosm support/chat_cli.cosm`

For local AI use, `cosm.ai` now assumes LM Studio by default:

- `COSM_AI_BACKEND=lmstudio` if unset
- `COSM_AI_BASE_URL=http://127.0.0.1:1234/v1` if unset
- `COSM_AI_MODEL` is optional when LM Studio exposes a model through `/v1/models`; set it explicitly to force a particular model
- inspect current config with `cosm.ai.status()`
- optional session timeout override: `COSM_SESSION_TIMEOUT_MS=1500` by default

## Dev Commands

- `bun test`
- `COSM_HTTP_INTEGRATION=1 bun test test/http.integration.test.ts`
- `COSM_AI_LIVE=1 bun test test/ai.integration.test.ts`
- `COSM_AI_LIVE=1 COSM_AI_MODEL=<model> bun test test/ai.integration.test.ts`
- `bun run lint`
- `just repl`
- `just server`
- `just watch-server`
- `just self-test`
- `just http-test`
- `bun bin/cosm --test test/test.cosm`
- `bun bin/cosm spec/core.cosm`
- `bun bin/cosm --test spec/runtime/baseline.cosm`
- `bun bin/cosm --watch app/server.cosm`
- `bun bin/cosm app/server.cosm --watch`
- `bun bin/cosm --help`

## Docs

- [Language reference](./doc/lang.md)
- [Feature snapshot](./doc/features.md)
- [Roadmap](./doc/roadmap.md)
- [Vision](./doc/vision.md)

## After 0.3.11

The immediate next milestones are:

1. finish `0.3.11` around the pure Cosm support chatbot, Slack-as-adapter, runtime consolidation, and harness-first specs
2. `0.4.0`: deepen the Slack support agent, session policy, and tool-light orchestration
3. post-`0.4.0`: broader persistent agent/runtime work, richer tool adapters, and later notebook/doc experiments

The immediate next track is:

1. finish and prove `0.3.11`
2. then deepen that Slack-facing support agent around sessions, data contracts, and tool-light orchestration
3. only after that broaden toward a more explicit persistent agent/runtime surface and richer notebook/doc models

The intended sequencing is:

- finish and prove `0.3.11`
- then pressure the platform further through the shipped Slack-facing app wedge
- then deepen Cosm-authored orchestration, tool contracts, and session policy from that proving app
- only after that reach for broader persistent agent work, richer notebook docs, or a fuller VM

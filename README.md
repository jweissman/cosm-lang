# cosm-lang

Cosm is a small reflective programming language built on top of the JS runtime.

## Current Focus

`0.3.8` is aimed at repairing and deepening the reflective surface while keeping the next proving app visible:

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
- universal receiver-side `methods()` reflection backed by the same lookup story as ordinary sends
- preferred `<%= ... %>` interpolation for `.ecosm`, while keeping `#{...}` working for compatibility
- a more exploratory notebook with debounced live eval, visible runtime status, and one-click examples
- a small Cosm-authored examples module for the notebook through `require("app/examples.cosm")`
- a clearer next wedge spec for a tiny DM-first Slack-facing persistent support agent, without implementing it yet

This is intentionally still below a full notebook product or framework layer. `0.3.8` is about turning the current runtime into a more honest reflective platform surface: explicit sessions, explicit AI, ergonomic data models, repaired receiver reflection, and a notebook that now teaches those layers from inside Cosm more directly.

Explicitly not in `0.3.8`:
- ampersand block capture or forwarding
- browser-side Cosm runtime
- Slack, MCP, or persistent agent runtime surfaces
- `data Foo ... end` syntax or model-declaration syntax
- notebook persistence or multi-user isolation
- Tailwind or any frontend styling stack as a language/runtime commitment
- broader route DSL syntax or router macros
- HTML tag-builder DSLs
- JS interop mirrors/holograms
- VM execution

In `0.3.8`, `yield(...)` remains a real but narrow language/runtime feature. It only invokes the current implicit trailing block; there is still no `&block`, block forwarding, or broader Ruby-style block object model.

The current dev-loop step is a small `--watch` mode for long-running entry files. It restarts a file from scratch when that file changes; it is not in-process hot reload. The CLI now also treats `--help`, unknown switches, and trailing `--watch` more deliberately.

Small services in `0.3.8` should now be organized as:

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
Kernel.send(1, :plus, 2)
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

Trailing `do ... end` on calls is still intentionally narrow in `0.3.8`: it is block/lambda sugar, not a full Ruby block system. The useful current step is block params on trailing blocks plus real `yield(...)`, so service code can now use:

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

The demo app now also exposes a small `/notebook` page plus a live-ish `/notebook/eval` endpoint with handwritten fetch-based updates, debounced live evaluation, one-click examples, server-side evaluation, and one explicit default session per running process. In `0.3.8`, that session still evaluates through a worker-backed isolation boundary with timeout/error wrapping, and the notebook now actively demonstrates receiver reflection, `Data.model(...)`, `Schema`, `Prompt`, `cosm.ai`, `require("cosm/ai.cosm")`, and `require("app/examples.cosm")`. `Kernel.eval(...)`, `Kernel.tryEval(...)`, and `Kernel.resetSession()` still exist, but they now delegate to `Session.default()`.

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
- `bun bin/cosm --watch app/server.cosm`
- `bun bin/cosm app/server.cosm --watch`
- `bun bin/cosm --help`

## Docs

- [Language reference](./doc/lang.md)
- [Feature snapshot](./doc/features.md)
- [Roadmap](./doc/roadmap.md)
- [Vision](./doc/vision.md)

## After 0.3.8

The immediate next track is:

1. deepen `Data` and more Cosm-authored orchestration layers from the repaired reflective surface
2. then decide how much more notebook/browser surface should be exposed
3. then build a tiny single-tenant DM-first Slack-facing support agent on sessions, AI, data models, and service modules

The intended sequencing is:

- finish and prove `0.3.8`
- then deepen `Data` and Cosm-authored stdlib surfaces
- then decide browser/runtime exposure from a stronger notebook shell
- only after that reach for Slack/MCP-backed persistent agent work

# cosm-lang

Cosm is a small reflective programming language built on top of the JS runtime.

It is aimed at interactive tooling and small server-side applications where the language itself stays explicit about reflection, dispatch, data contracts, and AI boundaries instead of hiding them behind framework magic.

## Language Shape

Cosm currently emphasizes:

- reflective classes, metaclasses, modules, and message send
- explicit runtime roots like `Kernel`, `classes`, `cosm`, `Schema`, `Data`, and `cosm.ai`
- object-first services through `HttpRouter`, `HttpRequest`, and `HttpResponse`
- a narrow but real block/callback story through trailing `do ... end` and `yield(...)`
- a small Cosm-authored platform layer for tests, support flows, notebook examples, and service wiring

## Current Focus

The current tree is best read as **`0.3.13.8`**. The main job of this patch line is still language/runtime hardening, with the current slice focused on turning the Slack adapter into a durable DM-first assistant while the persistent notebook remains the main proving wedge:

- keep shrinking interpreter-owned semantic policy and push more behavior toward explicit runtime/message-passing seams
- keep a small send-first VM subset alive through `--trace-ir` and `--vm`
- keep the support assistant explicit and small through a shared Cosm-authored core reused by the CLI chat, `/assistant`, notebook-attached assistant, and Slack
- keep the AI boundary explicit through `Prompt`, `Schema`, `Data`, `cosm.ai`, config-vs-health semantics, and callback-based streaming events
- keep the notebook as a persistent server-side workbench with whole-page execution and an attached assistant

What already feels real:

- reflective classes, metaclasses, module-backed `include(...)`, and message send
- `Kernel`, `classes`, `cosm`, `Schema`, `Data`, and `cosm.ai` as explicit runtime roots
- object-first services through `HttpRouter`, `HttpRequest`, and `HttpResponse`
- a narrow but real block story through trailing `do ... end` plus `yield(...)`
- small functional collection helpers like `map`, `select`, `filter`, `find`, `take`, and `reduce`
- explicit `Session` runtime objects for notebook/server eval
- a pure Cosm support-chat core through `require("support/chat.cosm")` and `support/chat_cli.cosm`
- a tiny page-backed assistant wedge at `/assistant`
- a durable DM-first Slack assistant with per-thread local memory

What is still deliberately narrow or deferred:

- ampersand block capture or forwarding
- browser-side Cosm runtime
- MCP, broad tool ecosystems, or generalized persistent multi-agent runtime surfaces
- `data Foo ... end` syntax or model-declaration syntax
- multi-user isolation
- Tailwind or any frontend styling stack as a language/runtime commitment
- broader route DSL syntax or router macros
- HTML tag-builder DSLs
- JS interop mirrors/holograms
- full VM execution

`yield(...)` remains intentionally narrow: it invokes the current trailing block and does not imply a fuller Ruby-style block-object system.

Small services are still meant to look like:

- a boot entry such as `app/server.cosm`
- an app/service module such as `app/app.cosm`
- one or more view modules under `app/views/...`
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

Trailing `do ... end` on calls is still intentionally narrow in `0.3.13.x`: it is block/lambda sugar, not a full Ruby block system. The useful current step is block params on trailing blocks plus real `yield(...)`, so service code can now use:

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

The demo app now exposes a persistent `/notebook` workbench with saved block pages, whole-page Cosm execution, one named session per page, and an attached assistant that reuses the shared support/controller core. The notebook actively demonstrates simplified receiver reflection, `Kernel.dispatch(...)`, `Kernel.tryValidate(...)`, explicit scalar casts like `to_i()` / `to_f()`, validation through `Schema` / `Data`, explicit `cosm.ai.cast(...)`, `require("app/examples.cosm")`, linear workflow helpers, and the same narrow assistant stack used by the CLI, `/assistant`, and Slack.

The canonical app also exposes a narrow Slack ingress at `/slack/events`. Verification, thread-local persistence, session/thread mapping, and outbound posting stay TS-owned, while prompt assembly, reply shaping, and model definitions live in Cosm under `support/`. The current Slack scope is intentionally DM-only, with durable local per-thread memory plus `help`, `status`, and `reset` style meta interactions.

You can also talk to the pure Cosm support loop directly:

- `bun bin/cosm support/chat_cli.cosm`
- `./script/bunx bin/cosm support/chat_cli.cosm`

For local AI use, `cosm.ai` now assumes LM Studio by default:

- `COSM_AI_BACKEND=lmstudio` if unset
- `COSM_AI_BASE_URL=http://127.0.0.1:1234/v1` if unset
- `COSM_AI_MODEL` is optional when LM Studio exposes a model through `/v1/models`; set it explicitly to force a particular model
- inspect discovered config with `cosm.ai.config()` or `cosm.ai.status()`
- probe backend reachability with `cosm.ai.health()`
- `cosm.ai.stream(...)` is explicit and now aims to reflect real transport streaming when the local backend supports OpenAI-compatible streamed chunks
- optional session timeout override: `COSM_SESSION_TIMEOUT_MS=1500` by default

## Dev Commands

- `./script/bunx <bun args>` for a repo-local Bun wrapper that restores the usual shell init
- `bun test`
- `COSM_HTTP_INTEGRATION=1 bun test test/http.integration.test.ts`
- `COSM_AI_LIVE=1 bun test test/ai.integration.test.ts`
- `COSM_AI_LIVE=1 COSM_AI_MODEL=<model> bun test test/ai.integration.test.ts`
- `bun run lint`
- `just repl`
- `just server`
- `just watch-server`
- `just bench-vm`
- `just self-test`
- `just http-test`
- `bun bin/cosm --test test/test.cosm`
- `bun bin/cosm spec/core.cosm`
- `bun bin/cosm --test spec/runtime/baseline.cosm`
- `bun bin/cosm --watch app/server.cosm`
- `bun bin/cosm app/server.cosm --watch`
- `bun bin/cosm --version`
- `bun bin/cosm -e '1 + 2'`
- `bun bin/cosm --help`

## Docs

- [Language reference](./doc/lang.md)
- [Feature snapshot](./doc/features.md)
- [Roadmap](./doc/roadmap.md)
- [Vision](./doc/vision.md)

## Near-Term Direction

The next useful milestones are:

1. keep pushing interpreter/runtime cleanup so message-passing seams, block forwarding, and invocation feel more MPI-shaped
2. keep widening the tiny VM subset only where it overlaps with real support/controller/app logic
3. make the support-chat transport more honest, and only add true streaming where the backend boundary can really support it
4. keep lifting small policy/workflow layers into Cosm without pretending the low-level runtime is ready to move

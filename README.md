# cosm-lang

Cosm is a small reflective programming language built on top of the JS runtime.

## Current Focus

`0.3.2` is aimed at a service-structure and notebook-usability follow-up on that first small web-service slice:

- reflective classes, metaclasses, and method lookup
- a tiny router/service story through `HttpRouter`
- router-level middleware through `HttpRouter.use(...)`
- trailing `do ... end` block passing with block params on calls
- HTML-friendly responses through `HttpResponse.html(...)`
- triple-quoted interpolated strings for small templates
- the first readonly reflective primitive through `Mirror.reflect(...)`
- a clearer class-side authoring path through `class << self`
- split view modules for app rendering
- a server-live notebook demo page with shared server-side eval

This is intentionally still below a full notebook product or framework layer. `0.3.2` is about making the runtime and service surface feel steadier to build on while proving one tiny interactive page.

Explicitly not in `0.3.2`:
- ampersand block capture or forwarding
- browser-side Cosm runtime
- notebook persistence or multi-user isolation
- Tailwind or any frontend styling stack as a language/runtime commitment
- broader route DSL syntax or router macros
- HTML tag-builder DSLs
- JS interop mirrors/holograms
- VM execution

The current dev-loop step is a small `--watch` mode for long-running entry files. It restarts a file from scratch when that file changes; it is not in-process hot reload. The CLI now also treats `--help`, unknown switches, and trailing `--watch` more deliberately.

Small services in `0.3.2` should now be organized as:

- a boot entry like `app/server.cosm`
- an app/service module like `app/app.cosm`
- one or more view modules like `app/views.cosm`
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

Trailing `do ... end` on calls is still intentionally narrow in `0.3.2`: it is lambda sugar, not a full Ruby block system. The useful new step is block params on trailing blocks, so service code can now use:

```cosm
router.draw do
  get "/" do |req|
    HttpResponse.html("<h1>Hello</h1>", 200)
  end
end
```

The demo app now also exposes a small `/notebook` page plus a live-ish `/notebook/eval` endpoint with handwritten fetch-based updates, server-side evaluation, and one shared session per running process. That is still an app-layer proof, not a runtime/browser commitment.

## Dev Commands

- `bun test`
- `COSM_HTTP_INTEGRATION=1 bun test test/http.integration.test.ts`
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

## After 0.3.2

The immediate next track is:

1. richer notebook shell and session ergonomics
2. then browser/runtime decisions
3. then deeper callable/block semantics
4. then broader framework/interop work

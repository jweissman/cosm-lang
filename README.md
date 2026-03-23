# cosm-lang

Cosm is a small reflective programming language built on top of the JS runtime.

## Current Focus

`0.3` is aimed at the first small but real web-service slice:

- reflective classes, metaclasses, and method lookup
- a tiny router/service story through `HttpRouter`
- HTML-friendly responses through `HttpResponse.html(...)`
- triple-quoted interpolated strings for small templates
- the first readonly reflective primitive through `Mirror.reflect(...)`
- a clearer class-side authoring path through `class << self`

This is intentionally still below a notebook app or framework layer. `0.3` is about making the runtime and service surface feel steady enough to build on.

Explicitly not in `0.3`:
- block-style lambdas like `do |req| ... end`
- `router.draw do ... end`
- notebook UI
- browser-side Cosm runtime
- Tailwind/frontend stack choices
- broader route DSL syntax or router macros
- HTML tag-builder DSLs
- JS interop mirrors/holograms
- VM execution

The current dev-loop step is a small `--watch` mode for long-running entry files. It restarts a file from scratch when that file changes; it is not in-process hot reload. The CLI now also treats `--help`, unknown switches, and trailing `--watch` more deliberately.

Small services in `0.3` should now be organized as:

- a boot entry like `app/server.cosm`
- one or more required `.cosm` modules like `app/app.cosm`
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
      router.draw(->() {
        get("/", ->(req) {
          HttpResponse.html("""<h1>Hello #{req.path}</h1>""", 200)
        })
      })
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

That `router.draw(->() { ... })` shape is the intended `0.3` boundary: the builder is runtime-backed through `does_not_understand(...)`, but richer block syntax is intentionally deferred.

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

## After 0.3

The immediate next track is:

1. module/app structure for service code
2. then a tiny server-side notebook shell
3. then browser/runtime decisions
4. then richer callable/block syntax growth

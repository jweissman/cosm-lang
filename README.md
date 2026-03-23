# cosm-lang

Cosm is a small reflective programming language built on top of the JS runtime.

## Current Focus

`0.2` is aimed at runtime + stdlib consolidation:

- reflective classes, metaclasses, and method lookup
- TS-backed runtime models for core values like `Kernel`, `Namespace`, `Module`, `Method`, `Function`, and `Symbol`
- explicit message send through `send`
- a tiny Cosm-native test flow through `require("cosm/test")`
- real `HttpRequest` / `HttpResponse` runtime objects around the first Bun-native host boundary
- the first small DSL hook through `does_not_understand(message, args)`

This is intentionally still below a notebook app or framework layer. `0.2` is about making the runtime and standard surface feel steady enough to build on.

The current dev-loop step is a small `--watch` mode for long-running entry files. It restarts a file from scratch when that file changes; it is not in-process hot reload. The CLI now also treats `--help`, unknown switches, and trailing `--watch` more deliberately.

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
let server = http.serve(3001, ->(req) {
  HttpResponse.text("hello " + req.path, 200)
})
```

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

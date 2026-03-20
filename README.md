# cosm-lang

Cosm is a small reflective programming language built on top of the JS runtime.

## Current Focus

`0.2` is aimed at runtime + stdlib consolidation:

- reflective classes, metaclasses, and method lookup
- TS-backed runtime models for core values like `Kernel`, `Namespace`, `Method`, `Function`, and `Symbol`
- explicit message send through `send`
- a tiny Cosm-native test flow through `require("cosm/test")`
- real `HttpRequest` / `HttpResponse` runtime objects around the first Bun-native host boundary

This is intentionally still below a notebook app or framework layer. `0.2` is about making the runtime and standard surface feel steady enough to build on.

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
let server = http.serve(3001, ->(req) {
  HttpResponse.text("hello " + req.path, 200)
})
```

## Dev Commands

- `bun test`
- `COSM_HTTP_INTEGRATION=1 bun test test/http.integration.test.ts`
- `bun run lint`
- `just repl`
- `just self-test`
- `just http-test`
- `bun bin/cosm --test test/test.cosm`

## Docs

- [Language reference](./doc/lang.md)
- [Feature snapshot](./doc/features.md)
- [Roadmap](./doc/roadmap.md)
- [Vision](./doc/vision.md)

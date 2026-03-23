# Cosm Features

## Current Release Target: 0.3

`0.3` is the first small web-service + reflective-primitive release:

- keep shrinking evaluator-owned behavior in favor of runtime-owned MPI
- make tiny server authoring feel real through `HttpRouter` and HTML responses
- add one simple reflective primitive through `Mirror`
- make class-side authoring less provisional through `class << self`
- improve testability and inspection without jumping to a notebook app or VM yet
- make the canonical app shape module-organized and boot-entry-oriented rather than monolithic

For `0.3`, the callable boundary stays intentionally narrow:

- `router.draw(->() { ... })` is in
- block-style lambdas like `do |req| ... end` are out
- `router.draw do ... end` is out
- richer block capture and variadics are out
- lexical `module ... end` is out

## Implemented Now

- Expressions with numeric arithmetic, comparisons, boolean logic, arrays, hashes, strings, and interpolation.
- Lexical `let` bindings, `do ... end` blocks, and `if ... then ... else ... end`.
- Stabby lambdas and named `def` functions with lexical closures.
- `class` definitions with inheritance, `def init(...)` constructors, reflective `.slots` and `.methods`, and instance creation through `Class.new(...)`.
- Instance methods with `self` and `@ivar` reads.
- Explicit class methods via `def self.name(...)`, reflected separately through `.classMethods`.
- Minimal per-class metaclasses, with `Class` as the bootstrap anchor for class-of-class reflection and metaclass inheritance that mirrors the ordinary class chain.
- Reflective class access through `classes`.
- Ambient reflective service objects through `Kernel` and `cosm`, with `Kernel` backed by its own reflective class and reflective roots like `cosm` / `classes` using a named `Namespace` class.
- A first reflective `Module` runtime object, with `cosm.test` and `cosm.modules.test` now modeled as real module objects rather than loose namespaces.
- Local `.cosm` files can now be loaded as reflective `Module` objects through `require("path/to/file.cosm")`. In `0.3`, that injects a basename-style module binding such as `app` for `require("app/app.cosm")`, which gives small services a more intentional boot/module split without adding lexical module syntax.
- A minimal `cosm --watch <file>` / `cosm watch <file>` CLI loop for restarting long-running entry files like `app/server.cosm` when the target file changes, plus clearer CLI usage/help and loud failures on unknown switches.
- Reflective method tables now also surface as `Namespace`-style objects rather than anonymous bags, which makes class reflection more consistent with the rest of the runtime.
- The core reflective/runtime classes now expose their native surface through one explicit manifest-style protocol, so bootstrap class tables and runtime lookup are drawing from the same declarations instead of parallel hand wiring.
- `Kernel` now owns real native `assert`, `print`, `puts`, `warn`, `inspect`, `send`, `expectEqual`, and a tiny `test(name, fn)` path in its TS value model. Host concerns are getting split into clearer homes: `Process` owns `cwd()` / `env(name)`, `Time` owns `now()`, `isoNow()`, and `iso(ms)`, and `Random` owns `float()` / `int(max)`. `Namespace` exposes `length`, `keys()`, `values()`, `has(...)`, and `get(...)` directly.
- `Process` now also exposes `pid()` and `exit(code?)`, which makes service boot/lifecycle work feel more real while keeping process concerns off `Kernel`.
- `Kernel.describe(name, fn)` now exists as a lightweight grouping primitive for the Cosm-native test harness, and `require("cosm/test")` now returns a real `Module` object while still injecting `test`, `describe`, `expectEqual`, `resetTests`, and `testSummary` into the current scope.
- A first Bun-native host-service slice now exists through `http` / `cosm.http`, with `http.serve(port, handler)` returning an `HttpServer` object that exposes `.port`, `.url`, and `.stop()`. `handler` may be a function, a bound method, or a service object that implements `handle(req)`.
- HTTP handlers now receive a real `HttpRequest` object and can return a string-like body, a transitional hash, or a first-class `HttpResponse` object created via `HttpResponse.ok(...)`, `HttpResponse.text(...)`, or `HttpResponse.json(...)`.
- `HttpRouter` now provides exact-path routing through `handle(method, path, handler)`, `get`, `post`, `put`, and `delete`, can build routes through `draw(->() { ... })`, and also acts as a service object through `handle(req)`.
- `HttpResponse.html(...)` now provides a small HTML-oriented response path with the right content type.
- Live localhost round-trip checks for that HTTP surface now live in `test/http.integration.test.ts` and run explicitly with `COSM_HTTP_INTEGRATION=1` rather than in the default sandbox-safe suite.
- Triple-double-quoted strings now provide a small multiline interpolated template path for server-side HTML output.
- Stabby lambdas may now contain statement-list bodies, which makes route handlers like logging-then-responding work without introducing a second lambda syntax.
- `Mirror.reflect(value)` now provides the first readonly reflective wrapper for inspection-oriented use cases.
- `class << self ... end` now exists as an explicit class-side authoring form alongside existing `def self.name(...)`.
- TS-backed interned `Symbol` values via `Symbol.intern("name")`.
- Explicit message-passing infrastructure via `receiver.send(...)` and `Kernel.send(...)`, plus `Kernel.inspect(...)` for Cosm-oriented inspection.
- First-class bound `Method` values with `.call(...)` and reflective lookup via `method(...)` / `classMethod(...)`.
- Basic message send through `obj.method(...)`, including class objects as receivers.
- A minimal `does_not_understand(message, args)` fallback protocol for missing instance sends, with `message` passed as a `Symbol` and `args` passed as an `Array`. The first concrete use is a tiny router builder layer, where `router.draw(...)` can interpret bare `get(...)` / `post(...)` calls without new route syntax.
- Primitive ownership beginning to move into TS runtime classes via native properties/methods such as numeric/string `plus` and string/array/hash `length`.
- Scalar equality and numeric ordering are now beginning to route through runtime message methods as well, instead of only evaluator branches.
- Bun tests, direct runtime tests, a CLI runner, and `test/core.cosm` as a language-level smoke test.

## In Progress

- Converging the evaluator and runtime onto one consistent message-dispatch path.
- Moving generic `send` and callable behavior like `Method.call(...)` out of interpreter special cases and into TS-backed runtime value classes.
- Deciding how far TS runtime values versus built-in Cosm classes should own primitive behavior during bootstrap, now that both sides exist.
- Extending the current bootstrap `Class` object into a fuller metaclass/class-of-class story.
- Keeping syntax cleanup staged rather than ad hoc: class/def `do` elision is in, while semicolon elision, variadics, and block capture are still deliberate next-step design work.
- Keeping advanced OO research concepts visible while bootstrap semantics settle: mirrors, holograms, delegation wrappers, and possible later template-driven structure forms.

## v0.3 Definition Of Done

- Core TS-backed runtime classes keep one explicit reflective/native surface protocol.
- Evaluator ownership continues shrinking toward AST evaluation, lexical scope, control flow, and invoke/send orchestration.
- `Kernel`, `Namespace`, `Mirror`, and `cosm` feel usable for ordinary experiments.
- `HttpRequest`, `HttpResponse`, `HttpServer`, and `HttpRouter` are real runtime objects rather than loose bootstrap shims.
- REPL, CLI, `test/core.cosm`, `test/test.cosm`, and the default Bun suite stay stable and green.
- Notebook/framework work is still intentionally post-`0.3`.

## Explicitly Not In v0.3

- block-style lambdas like `do |req| ... end`
- `router.draw do ... end`
- notebook UI or browser REPL
- shipping Cosm execution into the browser
- Tailwind or any frontend styling stack decision
- route DSL syntax or router macros
- lexical `module ... end`
- HTML tag-builder DSLs
- JS interop mirrors/holograms
- VM execution

## Next Likely Steps

- Organize service code through clearer module/app structure before adding more syntax.
- Build a tiny server-side notebook shell on top of that module/app structure.
- Decide browser/runtime exposure after the notebook shell exists.
- Stage callable growth explicitly only after that: variadic args first, block capture later, then richer missing-method/delegation work.
- Keep deepening modules as reflective runtime objects before introducing lexical `module ... end` syntax.
- Keep the watch loop intentionally narrow for now: target file only, full child-process restart, no in-process hot reload semantics.
- Keep growing the tiny Bun-native HTTP surface without turning it into a framework/router abstraction inside `0.3`.

## Current Reference Target

- A simple web notebook with a persistent Cosm session, structured inspect output, and enough runtime reflection to explore the object model live.

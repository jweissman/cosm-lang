# Cosm Features

## Current Release Target: 0.2

`0.2` is the runtime + stdlib consolidation release:

- keep shrinking evaluator-owned behavior in favor of runtime-owned MPI
- make `Kernel`, `Namespace`, and the reflective roots feel more complete
- deepen the first host boundary through real `HttpRequest` / `HttpResponse` objects
- improve testability and inspection without jumping to a notebook app or VM yet

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
- Reflective method tables now also surface as `Namespace`-style objects rather than anonymous bags, which makes class reflection more consistent with the rest of the runtime.
- The core reflective/runtime classes now expose their native surface through one explicit manifest-style protocol, so bootstrap class tables and runtime lookup are drawing from the same declarations instead of parallel hand wiring.
- `Kernel` now owns real native `assert`, `print`, `puts`, `warn`, `inspect`, `send`, `now`, `random`, `expectEqual`, and a tiny `test(name, fn)` path in its TS value model. Host process concerns like `cwd()` and `env(name)` now live on a dedicated reflective `Process` object, and `Namespace` exposes `length`, `keys()`, `values()`, `has(...)`, and `get(...)` directly.
- `Kernel.describe(name, fn)` now exists as a lightweight grouping primitive for the Cosm-native test harness, and `require("cosm/test")` can load `test`, `describe`, `expectEqual`, `resetTests`, and `testSummary` into the current scope.
- A first Bun-native host-service slice now exists through `http` / `cosm.http`, with `http.serve(port, handler)` returning an `HttpServer` object that exposes `.port`, `.url`, and `.stop()`.
- HTTP handlers now receive a real `HttpRequest` object and can return a string-like body, a transitional hash, or a first-class `HttpResponse` object created via `HttpResponse.ok(...)`, `HttpResponse.text(...)`, or `HttpResponse.json(...)`.
- Live localhost round-trip checks for that HTTP surface now live in `test/http.integration.test.ts` and run explicitly with `COSM_HTTP_INTEGRATION=1` rather than in the default sandbox-safe suite.
- TS-backed interned `Symbol` values via `Symbol.intern("name")`.
- Explicit message-passing infrastructure via `receiver.send(...)` and `Kernel.send(...)`, plus `Kernel.inspect(...)` for Cosm-oriented inspection.
- First-class bound `Method` values with `.call(...)` and reflective lookup via `method(...)` / `classMethod(...)`.
- Basic message send through `obj.method(...)`, including class objects as receivers.
- Primitive ownership beginning to move into TS runtime classes via native properties/methods such as numeric/string `plus` and string/array/hash `length`.
- Scalar equality and numeric ordering are now beginning to route through runtime message methods as well, instead of only evaluator branches.
- Bun tests, direct runtime tests, a CLI runner, and `test/core.cosm` as a language-level smoke test.

## In Progress

- Converging the evaluator and runtime onto one consistent message-dispatch path.
- Moving generic `send` and callable behavior like `Method.call(...)` out of interpreter special cases and into TS-backed runtime value classes.
- Deciding how far TS runtime values versus built-in Cosm classes should own primitive behavior during bootstrap, now that both sides exist.
- Extending the current bootstrap `Class` object into a fuller metaclass/class-of-class story.
- Keeping advanced OO research concepts visible while bootstrap semantics settle: mirrors, holograms, delegation wrappers, and possible later template-driven structure forms.

## v0.2 Definition Of Done

- Core TS-backed runtime classes keep one explicit reflective/native surface protocol.
- Evaluator ownership continues shrinking toward AST evaluation, lexical scope, control flow, and invoke/send orchestration.
- `Kernel`, `Namespace`, and `cosm` feel usable for ordinary experiments.
- `HttpRequest`, `HttpResponse`, and `HttpServer` are real runtime objects rather than loose bootstrap shims.
- REPL, CLI, `test/core.cosm`, `test/test.cosm`, and the default Bun suite stay stable and green.
- Notebook/framework work is still intentionally post-`0.2`.

## Next Likely Steps

- Extend class-side dispatch semantics deliberately.
- Move more operators and built-ins behind runtime/class dispatch.
- Fill in more baseline language services: stdio, math/random/time/process helpers, and a tiny test harness.
- Add explicit object-state setup/writes once assignment semantics exist.
- Design the first reflective metaclass links.
- Write down the intended metaclass-diamond/bootstrap rule before we add much richer class-side power.
- Explore later reflective OO ideas like mirrors, holograms, and delegation-oriented wrappers without forcing them into the core surface too early.
- Treat any future `template` / `data` forms as consequences of a clearer metaobject protocol, not as syntax we rush in ahead of semantics.
- Design how namespaces/modules should fit into the reflective object model.
- Add a lightweight Cosm-native test harness on top of the current self-test loop.
- Prepare a small notebook/playground service and JS interop layer once dispatch/reflection are steady enough to expose.
- Grow the tiny Bun-native HTTP surface into a more deliberate service/notebook host API.

## Current Reference Target

- A simple web notebook with a persistent Cosm session, structured inspect output, and enough runtime reflection to explore the object model live.

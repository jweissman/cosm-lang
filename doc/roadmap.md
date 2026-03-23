# Cosm Roadmap

## Product Goals

Cosm is aiming to be a small reflective language for building interactive tools in the JS universe.

The main goals are:

1. Interactive tooling
   Notebooks, dashboards, admin consoles, backend/SRE utilities, and exploratory scripts.
2. Reflective OO
   Real classes, metaclasses, delegation-friendly objects, and eventually mirrors or hologram-like wrappers.
3. Host interop
   Deep JS interop through a disciplined reflective boundary instead of raw escape hatches everywhere.
4. Data and program transformation
   Structured transforms, query-like operators, doc navigation, and later richer data/LLM workflows.
5. Cosm-authored platform
   Tests, services, notebook infrastructure, and eventually web-facing tooling written substantially in Cosm.

## Reference Build Target

The first concrete thing we should try to build is a simple web notebook:

- a persistent Cosm session on the server
- browser-visible evaluation results
- structured inspect output for runtime objects
- a place to explore classes, metaclasses, and interop

This target is useful because it pressures the right pieces of the runtime without forcing a full framework too early. It should shape near-term design decisions more than abstract “language completeness.”

The next concrete extension of that target is likely:

- a small HTTP/service layer
- webhook-friendly integrations such as Slack
- later, an explicit `cosm.ai` library for agentic or semantic helpers

Those should begin as standard/runtime libraries rather than syntax features, so the reflective object model stays in control of the semantics.

## Where We Are Now

- The language already has a stable-enough expression, function, and class surface to keep growing top-down through [test/core.cosm](/Users/joe/Work/cosm-lang/test/core.cosm).
- Ordinary inheritance works for instance methods and `init`-driven construction.
- Explicit class-side methods exist via `def self.name(...)`.
- Minimal per-class metaclasses exist, and class-side lookup already follows the metaclass chain.
- Primitive behavior is in a mixed bootstrap state: some behavior lives on TS runtime value classes, and some still lives in interpreter/class lookup glue.
- There is now an ambient `Kernel` object with its own reflective class, plus small `cosm` and `classes` namespace objects. That gives us a cleaner path for stdlib growth than leaving everything as anonymous globals.
- The first reflective `Module` runtime object now exists, with `cosm.test` acting as the first real module-shaped stdlib surface.

Classes and inheritance are far enough along to stop being the main blocker. The next leverage point is giving the runtime a more coherent standard surface: `Kernel`, inspect/stdio, namespaces/modules, and a cleaner ownership story for primitive dispatch.

Relative to the longer-term vision:

- Reflective OO is underway.
- Standard-surface work has started with `Kernel`, `Namespace`, `cosm`, and `Symbol`.
- Explicit message-passing is now beginning to surface through `send`, which is a good sign that dispatch can keep moving out of evaluator-only knowledge.
- Host interop is mostly still ahead of us.
- The notebook/platform story is still aspirational, but now concrete enough to guide sequencing.

## Tie Your Shoes Snapshot

What already feels real enough for everyday experiments:

- Numbers, strings, booleans, symbols, arrays, hashes, blocks, conditionals, functions, classes, and reflective roots.
- A persistent REPL/session loop.
- Assertions, inspection, explicit send, reflective namespace/class exploration, and basic stdio through `Kernel`.
- A language-level smoke test in [test/core.cosm](/Users/joe/Work/cosm-lang/test/core.cosm).
- A tiny Cosm-native test flow through `require("cosm/test")`, `test(...)`, `describe(...)`, and `bin/cosm --test`.

What still feels missing or provisional:

- Math/random/time/process-ish baseline services.
- Richer Cosm-native test assertions and suite structure beyond the current bootstrap harness.
- Assignment / ivar writes / richer object-state setup.
- Syntax lowering for omitted semicolons or implicit local binding.
- Modules as a first-class language form rather than only reflective runtime objects.
- Variadic args, block capture, and a richer missing-method/delegation protocol that higher-level DSLs can build on.
- Final CLI/dev-loop polish so the watch/test/help flows feel principled rather than ad hoc.

That suggests the next "tie your shoes" work should stay close to standard-surface basics, not just deep runtime theory.

## Completed Foundations

- Parser, lowering, and evaluation are separated.
- Core authoring ergonomics are in place: comments, strings, interpolation, lexical blocks, `if`, lambdas, `def`, and persistent REPL/session bindings.
- `test/core.cosm` acts as a language-level smoke test, backed by Bun specs and direct runtime tests.
- Class syntax, instance construction, inheritance, explicit class methods, and minimal metaclasses are working.

## Active Track: Runtime + Stdlib Consolidation

This is the current center of gravity.

### v0.2 Target

v0.2 should mean:

- a stable reflective runtime core
- clearer TS-backed ownership for the main runtime classes
- a steadier standard surface through `Kernel`, `Namespace`, `cosm`, and `classes`
- a first deliberate host boundary through `http`, `HttpRequest`, `HttpResponse`, and `HttpServer`
- no notebook app or framework layer yet

v0.2 intentionally does not include:

- a notebook app
- a framework/router layer
- Slack/webhook integration
- `cosm.ai`
- VM execution
- executable mirror/hologram objects
- `template` / `data` syntax

The immediate goal is to make the runtime feel steady enough that a later notebook or service layer is building on solid ground rather than bootstrap mush.

We are trying to make the object model feel unsurprising:

- Make member access and call composition support message send cleanly.
- Clarify what belongs on TS runtime value classes versus built-in Cosm objects/classes.
- Keep ordinary inheritance, class-side lookup, and metaclass lookup understandable from inside the language.
- Grow ambient services like `Kernel` and `cosm` into a real standard surface instead of scattered top-level helpers.

Current focus:

- Shared runtime dispatch paths replacing evaluator special-casing where practical.
- Primitive ownership moving into TS runtime value classes where that clarifies behavior better than repository closures.
- Scalar equality and numeric ordering beginning to move behind explicit runtime message methods.
- `Kernel` becoming the home for ambient services like `assert`, inspect, explicit `send`, and later stdio.
- The next OO/reflection design pressure is not just “metaclasses exist”, but “what is the eventual metaclass diamond/bootstrap rule for `Class`, `Object`, and per-class metaclasses?”
- Explicit `send` becoming a first-class runtime operation instead of only implicit surface syntax.
- The metaclass chain mirroring ordinary class inheritance closely enough to inspect and test from inside Cosm.
- Enough object-state semantics to make later JS interop and delegation rest on something real.
- A tiny Cosm-native test surface that is pleasant enough to drive real build targets like an HTTP notebook without immediately hard-coding framework ideas into the language.
- Keeping syntax simplification disciplined: `class`/`def` already allow `do` elision, while semicolon elision and richer callable syntax should land as explicit lowering/protocol work rather than ad hoc grammar hacks.
- Reflective module objects and a first minimal `does_not_understand(message, args)` fallback now exist as the bridge toward future DSL work, but lexical `module ... end`, splats, and block capture remain deliberately deferred.
- A narrow `cosm --watch <file>` loop now exists as a child-process restart convenience; the remaining CLI work is mainly polish around argument parsing, help, and error handling.

Questions this track should answer:

- Which behavior belongs on TS runtime values versus built-in Cosm classes during bootstrap?
- How explicit should metaclass access remain in user-facing reflection?
- How should inheritance, class-side behavior, and eventual delegation fit together without adding too much syntax too early?
- Should namespaces/modules behave like reflective objects first, lexical containers first, or both?
- What is the intended bootstrap "diamond" rule between `Class`, `Object`, per-class metaclasses, and later delegation/mirror concepts?
- How should future wrapper concepts like mirrors and holograms relate to ordinary objects, metaclasses, and host interop boundaries?
- If Cosm eventually gains `template`-style structure definitions, what metaobject protocol should those forms lower onto?

### v0.2 Definition Of Done

- Core reflective/runtime classes keep one explicit exposure protocol.
- `cosm.ts` is not the main declaration site for runtime surfaces.
- `Kernel`, `Namespace`, and the reflective roots cover the everyday "tie your shoes" surface more comfortably.
- `HttpRequest`, `HttpResponse`, and `HttpServer` are documented and test-covered.
- The self-test, tiny test harness, REPL, CLI, and default Bun suite remain green and stable.

Concrete next construction ideas:

- Continue moving arithmetic and string behavior behind dispatch-oriented TS runtime methods rather than evaluator branching.
- Grow `Kernel` into the home for inspect/print/stdio, time, randomness, and other tie-your-shoes functionality.
- Keep moving small harness/runtime services like `describe`, `send`, and callable protocol onto TS-backed runtime values rather than interpreter special cases.
- Deepen the HTTP host boundary through request/response objects rather than jumping to a framework/router abstraction.
- Tighten CLI/dev-loop polish so watch, test, help, and error handling feel deliberate and unsurprising.
- Add a conservative newline-to-semicolon lowering pass once we have a design we trust.
- Stage callable growth in small pieces: variadics, then block capture, then missing-method/delegation hooks.
- Keep the near-term web-service path intentionally object-oriented: `http.serve(port, App.new())` should feel like the canonical minimal service shape before any route DSLs appear.
- Make the bootstrap metaclass story explicit enough that later “diamond” questions have a written target instead of lingering as folklore.
- Keep moving dispatch-heavy operations behind explicit message-send paths so a later VM would have a cleaner semantic core to target.
- Decide how namespaces/modules should relate to the existing reflective repository, so object reflection and code organization grow together instead of separately.
- Introduce explicit ivar setup/writes once assignment semantics are ready, instead of overloading `init` params forever.
- Sketch a small Cosm-level test harness once block/message infrastructure is steady enough to support it cleanly.
- Keep making reflective surfaces like `.methods` and `.classMethods` look like real named runtime objects instead of ad hoc bags.

Recommended next slice:

- Finish the remaining CLI/dev-loop polish around watch/test/help.
- Then optimize the near-term track for a web-service vertical slice: module organization for `app/server.cosm`, small startup/server ergonomics, and notebook-adjacent service scaffolding.
- Continue making reflective roots (`Kernel`, `cosm`, `classes`, future modules) feel like real objects instead of interpreter conveniences.
- Keep deepening the HTTP surface without jumping to a router/framework abstraction.

## Research Themes

These are not immediate implementation commitments, but they should shape the runtime we are building toward:

- Metaclass bootstrap and eventual diamond clarity.
- Mirrors and hologram-like reflective wrappers for presentation, delegation, or readonly views.
- Reflective primitives that let object inspection and message dispatch feel explicit rather than magical.
- A notebook/http runtime that can expose live Cosm objects and sessions without collapsing straight into raw host JS objects.
- Template-driven structure forms as a later consequence of the reflective core, potentially covering both class-like and more immutable data-like structures.

## Next Platform Track: Standard Surface

This is the next likely leap in usefulness.

- `Kernel` for `assert`, inspect, print, stdio, and ambient programming helpers.
- Basic math/random/time/process-ish services once there is a coherent home for them.
- A reflective `cosm` root object that can expose runtime services without making every feature a bare global.
- Eventually namespaces/modules as objects that can introspect the constants they contain.

## Later Track: Host Interop

- First tiny Bun-native host services like `http.serve(...)`.
- JS object mirrors and conversion rules.
- Safe method/property bridging.
- Module import/load story.
- Host services for HTTP, filesystem, clocks, randomness, and processes.
- Later, an explicit `cosm.ai` or similar library surface for LLM-backed completions and semantic helpers.

This track is important, but it should land on top of a runtime that already explains object identity, dispatch, and reflection coherently.

## Later Track: Interactive Platform

- Cosm-native test harnesses and better suite-running support.
- Notebook/playground web service.
- Dashboard/app primitives.
- Query/data transformation tools, including possible SQL/doc-nav layers.
- LLM-assisted transformations once the language/runtime boundary is much steadier.

The notebook target should likely begin as:

- one server-side Cosm session
- one browser client
- evaluation history
- structured value inspection

Only after that should we reach for synchronized browser/server UI state or a higher-level UI framework.

## Ordering Notes

- Syntax sugar like semicolon omission or implicit `let` should ideally arrive via lowering once the core execution model is stable, rather than complicating the main grammar early.
- Splat args, block capture, and method-missing style hooks should likewise arrive in staged protocol/lowering work, not all at once through Ruby-shaped surface syntax.
- Loops still remain a later feature until reassignment or a stronger immutable iteration story exists.
- A full object-dispatch replacement for evaluator type checks should wait until class and method lookup semantics are stable.
- Web-service layers and JS interop are important goals, but they should land on top of a runtime that already explains object identity, dispatch, and reflection coherently.
- A VM may eventually help performance or tooling, but it is still downstream of settling dispatch/reflection/module/std-surface semantics.
- The strongest VM preparation we can do now is to reduce evaluator-owned primitive behavior and make `send`/invoke/control-flow boundaries more explicit.

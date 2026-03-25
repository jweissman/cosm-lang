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

## Current Milestones

### Milestone A: Semantic Coherence (`0.3.11`)

- make `cast(...)` AI-owned in the taught surface
- remove local schema/model conversion as a taught feature
- add explicit scalar casts like `to_s()`, `to_i()`, and `to_f()` on core values
- reduce interpreter-owned semantic special cases
- keep reflection, dispatch, and docs telling the same story

### Milestone B: VM Prep Becomes Real (`0.3.11`)

- add a VM-oriented IR for a narrow executable subset
- make CLI tracing show surface AST, core AST, and IR
- add a tiny opt-in VM executor for that subset

### Milestone C: First Real Agentic App Wedge (`0.3.11`)

- build a tiny DM-first Slack support bot
- map one `Session` per Slack conversation/thread
- keep prompts, orchestration, and reply shaping in Cosm
- keep ingress, signatures, and raw adapters in TS

## Where We Are Now

- The language already has a stable-enough expression, function, and class surface to keep growing top-down through [test/core.cosm](/Users/joe/Work/cosm-lang/test/core.cosm).
- Ordinary inheritance works for instance methods and `init`-driven construction.
- Explicit class-side methods exist via `def self.name(...)`.
- Minimal per-class metaclasses exist, and class-side lookup already follows the metaclass chain.
- Primitive behavior is in a mixed bootstrap state: some behavior lives on TS runtime value classes, and some still lives in interpreter/class lookup glue.
- There is now an ambient `Kernel` object with its own reflective class, plus small `cosm` and `classes` namespace objects. That gives us a cleaner path for stdlib growth than leaving everything as anonymous globals.
- The first reflective `Module` runtime object now exists, with `cosm.test` acting as the first real module-shaped stdlib surface.
- Local `.cosm` files can now also be loaded as reflective `Module` objects through `require("path/to/file.cosm")`, which is enough to start giving small services an app/boot split before lexical module syntax exists.

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

- Assignment / ivar writes / richer object-state setup.
- Syntax lowering for omitted semicolons or implicit local binding.
- Modules as a first-class language form rather than only reflective runtime objects.
- Variadic args, block capture, and a richer missing-method/delegation protocol that higher-level DSLs can build on.
- Richer notebook/session management beyond the current shared-process live-ish page.
- Browser-side Cosm execution and broader host/browser runtime decisions.
- Final CLI/dev-loop polish is much better now, but broader project/module watch semantics are still intentionally deferred.

What is deliberately not part of `0.3.11` even if it is attractive:

- ampersand block capture/passing
- notebook UI beyond the tiny shared-session demo page
- browser-side Cosm runtime
- Slack/MCP tool ecosystems or generalized persistent agent runtime surfaces
- `data` syntax or model-declaration syntax
- Tailwind/frontend stack decisions as language/runtime commitments
- route params, wildcards, middleware groups, or route macros
- lexical `module ... end`
- HTML tag-builder DSLs
- JS interop mirrors/holograms
- full VM execution

That suggests the next "tie your shoes" work should stay close to standard-surface basics, not just deep runtime theory.

## Completed Foundations

- Parser, lowering, and evaluation are separated.
- Core authoring ergonomics are in place: comments, strings, interpolation, lexical blocks, `if`, lambdas, `def`, and persistent REPL/session bindings.
- `test/core.cosm` acts as a language-level smoke test, backed by Bun specs and direct runtime tests.
- Class syntax, instance construction, inheritance, explicit class methods, and minimal metaclasses are working.

## Active Track: Runtime + Stdlib Consolidation

This is the current center of gravity.

### v0.3.11 Target

v0.3.11 should mean:

- a stable reflective runtime core
- clearer TS-backed ownership for the main runtime classes
- a steadier standard surface through `Kernel`, `Namespace`, `cosm`, and `classes`
- a first deliberate service layer through `http`, `HttpRequest`, `HttpResponse`, `HttpServer`, and `HttpRouter`
- router-level middleware and a clearer app/view module split for small services
- trailing `do ... end` block passing as narrow final-argument sugar, now with block params on trailing call blocks
- real narrow `yield(...)` as the first explicit in-language block invocation primitive
- one tiny server-rendered notebook demo page with live-ish partial updates backed by an explicit default session
- real `inspect()` and `to_s()` protocols across runtime values
- `Session` as an explicit runtime object for notebook/server eval, with worker-backed isolation and timeout/error wrapping
- a usable explicit AI boundary through `Prompt`, `Schema`, `cosm.ai`, `~=`, and LM Studio defaults, including model auto-discovery through `/v1/models`
- a library-first `Data` module and `DataModel` runtime values on top of `Schema`
- a first Cosm-authored stdlib helper layer through `require("cosm/ai.cosm")`
- local schema/model work kept validation-only through `validate(...)`, while `cast(...)` stays the AI-shaped term through `cosm.ai.cast(...)`
- repaired receiver-side reflection through universal `methods()` as a symbol-list surface, with `method(:name)` for concrete lookup
- explicit helper-form dispatch through `Kernel.dispatch(receiver, message, ...)`
- a final tie-your-shoes polish pass through helpers like `Kernel.uuid()`, `Kernel.tryValidate(...)`, `Kernel.trace(...)`, `Kernel.readline(...)`, and `Random.choice(...)`
- a first real VM-prep artifact through a narrow IR, `--trace-ir`, and `--vm` for a supported subset
- `.ecosm` templates under `app/views/...` replacing giant inline HTML blobs in the canonical app, with layout composition aligned around narrow `yield()`
- preferred `<%= ... %>` interpolation for `.ecosm`, while keeping `#{...}` available for compatibility
- a notebook page that now acts as a real teaching surface, with debounced live eval, Cosm-inspected output, secondary examples, and one-click examples for `Data`, `Schema`, `Prompt`, `cosm.ai`, and `require("cosm/ai.cosm")`
- a small Cosm-authored `app/examples.cosm` surface so notebook examples are no longer only view-local strings
- one simple reflective primitive through `Mirror`
- no notebook app or framework layer yet

v0.3.11 intentionally does not include:

- ampersand block capture/passing
- a notebook app beyond the tiny shared-session demo page
- a framework/router layer
- Slack/MCP tool ecosystems or generalized persistent agent-runtime surfaces
- automatic prompt literals or ambient AI semantics
- full VM execution
- holograms or JS-host mirror bridges
- `template` / `data` syntax
- route params, wildcards, middleware groups, or route macros
- HTML tag-builder DSL
- variadics / block capture
- `&block` capture/forwarding or broader block-object semantics

The immediate goal is to make the runtime and tiny service surface feel steady enough that a later notebook or richer service layer is building on solid ground rather than bootstrap mush.

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
- Reflective module objects and a first minimal `does_not_understand(message, args)` fallback now exist as the bridge toward future DSL work. The first concrete payoff is a tiny `router.draw(...)` builder path for route registration, while lexical `module ... end`, splats, and block capture remain deliberately deferred.
- The next useful consolidation step is to make the app/module split feel canonical, so `app/server.cosm` reads like a boot entry and `app/app.cosm` reads like the service module.
- `router.draw do ... end` plus `get "/" do |req| ... end` are enough to count as the current routing ergonomics boundary in `0.3.11`; we should not broaden the release into full Ruby-shaped block syntax.
- A narrow `cosm --watch <file>` loop now exists as a child-process restart convenience; the remaining CLI work is mainly polish around argument parsing, help, and error handling.

Questions this track should answer:

- Which behavior belongs on TS runtime values versus built-in Cosm classes during bootstrap?
- How explicit should metaclass access remain in user-facing reflection?
- How should inheritance, class-side behavior, and eventual delegation fit together without adding too much syntax too early?
- Should namespaces/modules behave like reflective objects first, lexical containers first, or both?
- What is the intended bootstrap "diamond" rule between `Class`, `Object`, per-class metaclasses, and later delegation/mirror concepts?
- How should future wrapper concepts like mirrors and holograms relate to ordinary objects, metaclasses, and host interop boundaries?
- If Cosm eventually gains `template`-style structure definitions, what metaobject protocol should those forms lower onto?

### v0.3.11 Definition Of Done

- Core reflective/runtime classes keep one explicit exposure protocol.
- `cosm.ts` is not the main declaration site for runtime surfaces.
- `Kernel`, `Namespace`, `Mirror`, and the reflective roots cover the everyday "tie your shoes" surface more comfortably.
- `Session` covers the explicit notebook/server eval surface rather than hidden shared state.
- `Session.default()` evaluates through a worker-backed isolation boundary with timeout/error wrapping, controlled by `COSM_SESSION_TIMEOUT_MS`.
- `Process` covers the basic host boot/lifecycle surface needed for tiny services: `cwd`, `env`, `argv`, `pid`, and `exit`.
- `Process`, `Kernel`, and `Time` cover the additional tiny comfort surface needed for service/notebook work: `platform`, `arch`, `sleep`, and `fromIso`.
- `inspect()`, `to_s()`, and `Kernel.blockGiven()` behave consistently through runtime dispatch.
- `cosm.ai.status()` plus LM Studio defaults make the explicit AI surface locally usable, while `Schema.jsonSchema()` gives the casting path a stable structural contract.
- `Data` and `DataModel` provide an ergonomic schema-backed model layer for app/notebook/AI code, with local schema/model checks staying validation-only.
- `cosm/ai.cosm` proves that higher-level helper code can now live in Cosm instead of only TS.
- A VM-oriented IR exists, `--trace-ir` can show it, and `--vm` can execute a narrow supported subset without silently diverging.
- `methods()` works across ordinary receivers as a symbol-list view of inherited visible methods plus runtime-backed primitive methods.
- `Mirror.methods()` aligns with the repaired receiver-side reflection model instead of exposing a parallel method-table story.
- `.ecosm` supports preferred `<%= ... %>` interpolation without breaking `#{...}` compatibility.
- The canonical notebook page teaches the intended layering between `Schema`, `Data`, `cosm.ai`, and `require("cosm/ai.cosm")`.
- The canonical notebook examples now also teach repaired receiver reflection through a small Cosm-authored examples module.
- The notebook supports debounced live eval, ships with examples that pressure reflection, models, and AI together, and keeps lightweight browser-local recent snippets.
- A dedicated live LM Studio integration target is documented and passes against a real local LM Studio instance: `COSM_AI_LIVE=1 bun test test/ai.integration.test.ts`. `COSM_AI_MODEL=<model>` remains optional when auto-discovery is insufficient or you want to force a specific model.
- `HttpRequest`, `HttpResponse`, `HttpServer`, and `HttpRouter` are documented and test-covered.
- The canonical app demonstrates a split boot/app/views structure, router middleware, `router.draw do ... end`, `get "/" do |req| ... end`, and a tiny `/notebook` route without introducing full block semantics or browser execution.
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
- Keep the routing DSL runtime-backed and narrow for now: `router.draw(...)` can smooth over bare verb calls, but route params, wildcards, middleware, and route macros should stay deferred.
- Make `Mirror` the first readonly reflective wrapper before reaching for richer hologram/delegation concepts.
- Keep stabby lambdas as the only standalone parameterized lambda form in `0.3.11`; route-handler ergonomics should come from statement-list bodies plus narrow trailing-block sugar rather than new callable syntax families.
- Make the bootstrap metaclass story explicit enough that later “diamond” questions have a written target instead of lingering as folklore.
- Keep moving dispatch-heavy operations behind explicit message-send paths so a later VM would have a cleaner semantic core to target.
- Decide how namespaces/modules should relate to the existing reflective repository, so object reflection and code organization grow together instead of separately.
- Introduce explicit ivar setup/writes once assignment semantics are ready, instead of overloading `init` params forever.
- Sketch a small Cosm-level test harness once block/message infrastructure is steady enough to support it cleanly.
- Keep making reflective surfaces like `.methods` and `.classMethods` look like real named runtime objects instead of ad hoc bags.

## Current Proving App: Tiny DM-First Slack Support Agent (`0.3.11`)

This is now the first concrete proving wedge in `0.3.11`, and the next step is to deepen it rather than keep it hypothetical.

Desired shape:

- a tiny single-tenant support agent reachable through Slack
- built on `Session`, `Data` / `DataModel`, `cosm.ai`, and service modules
- intentionally tool-light at first: Slack first, then one or two adapters like GitHub or Atlassian, with MCP only after the basic agent/service shape feels real

Recommended first cut:

- inbound surface: Slack DM-first rather than a broad events matrix
- session mapping: one Cosm `Session` per Slack conversation/thread
- structured data layer:
  - `Conversation`
  - `InboundMessage`
  - `AgentReply`
  - `ToolCall`
  - `ToolResult`
- prompts live in checked-in Cosm modules, not inline webhook handlers
- AI calls stay explicit through `Prompt`, `Schema`, `Data`, and `cosm.ai`
- service code owns retries, formatting, and error shaping explicitly

Important non-goals for the first wedge:

- no autonomy theater
- no multi-agent runtime
- no background swarms
- no giant MCP surface area
- no browser runtime dependency

The point of this wedge is not “agents” in the abstract. It is to pressure:

- durable sessions
- schema-backed message/tool contracts
- Cosm-authored orchestration libraries
- explicit AI/runtime boundaries
- service/module composition under a real user-facing interface

Recommended next slice:

- Treat `0.3.11` as the point where the runtime starts behaving more like a semantically coherent workbench with a real VM-prep artifact instead of only a recursive-eval interpreter.
- Use the immediate next track to deepen `Data` and other Cosm-authored stdlib layers from the new module/app/views + middleware + data-model structure.
- Then decide browser/runtime exposure from that stronger server-side notebook footing.
- Only after the current Slack wedge feels steady, reach for a broader persistent agent runtime with Slack/MCP-style adapters as standard/runtime libraries rather than syntax features.
- Leave ampersand block capture, variadics, and richer callable/block syntax for after those steps.

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

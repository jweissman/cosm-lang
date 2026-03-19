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

## Where We Are Now

- The language already has a stable-enough expression, function, and class surface to keep growing top-down through [test/core.cosm](/Users/joe/Work/cosm-lang/test/core.cosm).
- Ordinary inheritance works for instance methods and `init`-driven construction.
- Explicit class-side methods exist via `def self.name(...)`.
- Minimal per-class metaclasses exist, and class-side lookup already follows the metaclass chain.
- Primitive behavior is in a mixed bootstrap state: some behavior lives on TS runtime value classes, and some still lives in interpreter/class lookup glue.
- There is now an ambient `Kernel` object with its own reflective class, plus a small `cosm` namespace object. That gives us a cleaner path for stdlib growth than leaving everything as anonymous globals.

Classes and inheritance are far enough along to stop being the main blocker. The next leverage point is giving the runtime a more coherent standard surface: `Kernel`, inspect/stdio, namespaces/modules, and a cleaner ownership story for primitive dispatch.

Relative to the longer-term vision:

- Reflective OO is underway.
- Standard-surface work has started with `Kernel`, `Namespace`, `cosm`, and `Symbol`.
- Explicit message-passing is now beginning to surface through `send`, which is a good sign that dispatch can keep moving out of evaluator-only knowledge.
- Host interop is mostly still ahead of us.
- The notebook/platform story is still aspirational, but now concrete enough to guide sequencing.

## Completed Foundations

- Parser, lowering, and evaluation are separated.
- Core authoring ergonomics are in place: comments, strings, interpolation, lexical blocks, `if`, lambdas, `def`, and persistent REPL/session bindings.
- `test/core.cosm` acts as a language-level smoke test, backed by Bun specs and direct runtime tests.
- Class syntax, instance construction, inheritance, explicit class methods, and minimal metaclasses are working.

## Active Track: Reflective Runtime Core

This is the current center of gravity.

We are trying to make the object model feel unsurprising:

- Make member access and call composition support message send cleanly.
- Clarify what belongs on TS runtime value classes versus built-in Cosm objects/classes.
- Keep ordinary inheritance, class-side lookup, and metaclass lookup understandable from inside the language.
- Grow ambient services like `Kernel` and `cosm` into a real standard surface instead of scattered top-level helpers.

Current focus:

- Shared runtime dispatch paths replacing evaluator special-casing where practical.
- Primitive ownership moving into TS runtime value classes where that clarifies behavior better than repository closures.
- Scalar equality and numeric ordering beginning to move behind explicit runtime message methods.
- `Kernel` becoming the home for ambient services like `assert`, inspect, and later stdio.
- Explicit `send` becoming a first-class runtime operation instead of only implicit surface syntax.
- The metaclass chain mirroring ordinary class inheritance closely enough to inspect and test from inside Cosm.
- Enough object-state semantics to make later JS interop and delegation rest on something real.

Questions this track should answer:

- Which behavior belongs on TS runtime values versus built-in Cosm classes during bootstrap?
- How explicit should metaclass access remain in user-facing reflection?
- How should inheritance, class-side behavior, and eventual delegation fit together without adding too much syntax too early?
- Should namespaces/modules behave like reflective objects first, lexical containers first, or both?

Concrete next construction ideas:

- Continue moving arithmetic and string behavior behind dispatch-oriented TS runtime methods rather than evaluator branching.
- Grow `Kernel` into the home for inspect/print/stdio and other tie-your-shoes functionality.
- Keep moving dispatch-heavy operations behind explicit message-send paths so a later VM would have a cleaner semantic core to target.
- Decide how namespaces/modules should relate to the existing reflective repository, so object reflection and code organization grow together instead of separately.
- Introduce explicit ivar setup/writes once assignment semantics are ready, instead of overloading `init` params forever.
- Sketch a small Cosm-level test harness once block/message infrastructure is steady enough to support it cleanly.

Recommended next slice:

- Keep moving primitive behavior out of evaluator switches and into TS-backed runtime values or explicit runtime objects.
- Add the first inspect/print surface on `Kernel`.
- Continue making reflective roots (`Kernel`, `cosm`, `classes`, future modules) feel like real objects instead of interpreter conveniences.

## Next Platform Track: Standard Surface

This is the next likely leap in usefulness.

- `Kernel` for `assert`, inspect, print, stdio, and ambient programming helpers.
- Basic math/random/time/process-ish services once there is a coherent home for them.
- A reflective `cosm` root object that can expose runtime services without making every feature a bare global.
- Eventually namespaces/modules as objects that can introspect the constants they contain.

## Later Track: Host Interop

- JS object mirrors and conversion rules.
- Safe method/property bridging.
- Module import/load story.
- Host services for HTTP, filesystem, clocks, randomness, and processes.

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
- Loops still remain a later feature until reassignment or a stronger immutable iteration story exists.
- A full object-dispatch replacement for evaluator type checks should wait until class and method lookup semantics are stable.
- Web-service layers and JS interop are important goals, but they should land on top of a runtime that already explains object identity, dispatch, and reflection coherently.
- A VM may eventually help performance or tooling, but it is still downstream of settling dispatch/reflection/module/std-surface semantics.
- The strongest VM preparation we can do now is to reduce evaluator-owned primitive behavior and make `send`/invoke/control-flow boundaries more explicit.

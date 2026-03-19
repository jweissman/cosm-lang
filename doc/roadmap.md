# Cosm Roadmap

## Near-Term Goal

Build toward an object model with real reflection and message-passing, while keeping the core language small enough to understand and test from inside Cosm itself.

## Where We Are Now

- The language has a stable-enough expression, function, and class surface to keep growing top-down through `test/core.cosm`.
- Ordinary inheritance works for instance methods and `init`-driven construction.
- Explicit class-side methods exist via `def self.name(...)`.
- Minimal per-class metaclasses exist, and class-side lookup already follows the metaclass chain.
- Primitive behavior is in a mixed bootstrap state: some behavior lives on TS runtime value classes, and some still lives in interpreter/class lookup glue.

The important remaining work is not “make classes exist,” but “make the object model feel unsurprising.” That means clarifying reflection, tightening dispatch ownership, and deciding how modules, `Kernel`, and later JS interop fit into the same universe.

## Phases

### 1. Completed Foundations

- Parser, lowering, and evaluation are separated.
- Core authoring ergonomics are in place: comments, strings, interpolation, lexical blocks, `if`, lambdas, `def`, and persistent REPL/session bindings.
- `test/core.cosm` acts as a language-level smoke test, backed by Bun specs and direct runtime tests.

### 2. Completed Class Bootstrap

- `class` is a first-class syntax form lowered independently of evaluation.
- User-defined classes register into the current repository and appear in `classes`.
- `def` in class bodies establishes methods, and `def init(...)` establishes constructor arity/field metadata.
- Instances, reflective slots/methods, inheritance, and `@ivar` reads are all available.

### 3. Stand up message-passing infrastructure

- Make member access and call composition support method sends cleanly.
- Make instance state explicit through `init`-driven constructor fields and internal slot metadata.
- Clarify variable provenance inside methods with explicit ivar reads.
- Move operations like `+` toward object-space dispatch where appropriate.
- Keep a small built-in fallback layer while the object model comes online.

This is the phase where numeric/string primitives can start deferring to `:+`-style behavior rather than special-casing everything in the evaluator.

Current focus inside this phase:

- Instance method lookup across superclass chains.
- Explicit class-side methods via `def self.name(...)`, instead of overloading ordinary `def`.
- Class objects participating in method send only through that explicit class-side method space.
- Minimal per-class metaclasses owning class-side lookup, with `Class` as the bootstrap anchor.
- The metaclass chain mirroring ordinary class inheritance closely enough to inspect and test from inside Cosm.
- Shared runtime dispatch paths replacing evaluator special-casing where practical.
- Primitive ownership moving into TS runtime value classes where that clarifies behavior better than repository closures.
- Enough object-state semantics to make later metaclass and JS interop rest on something real.

Questions this phase should answer:

- Which behavior belongs on TS runtime value classes versus built-in Cosm classes during bootstrap?
- How explicit should metaclass access remain in user-facing reflection?
- How should normal OO concerns like inheritance, class-side behavior, and eventual delegation fit together without adding too much syntax too early?
- What should the eventual home of globals like `assert`, inspect, and stdio be: top-level names, `Kernel`, or reflective modules?

Concrete next construction ideas:

- Continue moving arithmetic and string behavior behind dispatch-oriented TS runtime methods rather than evaluator branching.
- Decide how much built-in behavior should live on TS runtime values versus built-in Cosm classes during bootstrap.
- Turn the current bootstrap `Class` object into a fuller metaclass story, including coherent lookup rules, superclass relationships, and eventually explicit metaclass construction semantics.
- Decide how namespaces/modules should relate to the existing reflective repository, so object reflection and code organization grow together instead of separately.
- Introduce explicit ivar setup/writes once assignment semantics are ready, instead of overloading `init` params forever.
- Sketch a small Cosm-level test harness once block/message infrastructure is steady enough to support it cleanly.

### 4. Add reflection and metaclasses

- Make classes ordinary objects with a class of their own.
- Expose reflective links like object -> class and class -> metaclass.
- Define how method lookup walks superclass and metaclass chains.
- Decide whether namespaces/modules are reflective objects, lexical containers, or both.
- Decide whether class-side authoring needs a richer protocol than `def self.name(...)`, such as singleton-class style syntax, or whether that should wait until the underlying model is less provisional.

The target here is not just “classes exist,” but “the runtime can explain itself from inside the language.”

### 5. Grow Cosm-authored tooling

- Improve `assert` and self-test conventions.
- Add a small Cosm-level test DSL once block/method passing is real.
- Expand the CLI to support running suites and reporting failures clearly.
- Replace raw host-oriented output with a clearer Cosm-oriented inspect/print/stdio path, likely tied into future `Kernel` work.
- Revisit semicolon elision and implicit-local sugar as a lowering/desugaring concern once the object model is steadier.
- Build toward a notebook/playground service and JS/web-facing interop only after the class/message model is stable enough to expose confidently.

## Ordering Notes

- Comments and interpolation help immediately, but they should not derail class/message work.
- Basic analysis should stay in service of the runtime model, not run ahead of it; richer type reasoning will get much clearer once message dispatch and class structure exist.
- Syntax sugar like semicolon omission or implicit `let` should ideally arrive via lowering once the core execution model is stable, rather than complicating the main grammar early.
- Loops still remain a later feature until reassignment or a stronger immutable iteration story exists.
- A full object-dispatch replacement for evaluator type checks should wait until class and method lookup semantics are stable.
- JS interop and web-service layers are important goals, but they should land on top of a runtime that already explains object identity, dispatch, and reflection coherently.

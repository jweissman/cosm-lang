# Cosm Roadmap

## Near-Term Goal

Build toward an object model with real reflection and message-passing, while keeping the core language small enough to understand and test from inside Cosm itself.

## Phases

### 1. Stabilize the core loop

- Keep parser, lowering, and evaluation separate.
- Keep `test/core.cosm` current as an executable language smoke test.
- Support source-level ergonomics that help authoring and testing:
  comments, strings, interpolation, and clearer diagnostics.
- Add lightweight structural analysis where it buys clarity:
  better block-aware errors, basic scope checks, and eventually simple forward type information.

### 2. Introduce class syntax without full metaclass machinery

- Add a dedicated `class` form to the grammar.
- Lower `class` into a core node instead of baking runtime behavior into parsing.
- Register user-defined classes in the global repository.
- Allow `def` inside class bodies as the first method-definition form.

This phase should answer: what is a class object, how is it named, and how are methods stored?

### 3. Stand up message-passing infrastructure

- Make member access and call composition support method sends cleanly.
- Move operations like `+` toward object-space dispatch where appropriate.
- Keep a small built-in fallback layer while the object model comes online.

This is the phase where numeric/string primitives can start deferring to `:+`-style behavior rather than special-casing everything in the evaluator.

### 4. Add reflection and metaclasses

- Make classes ordinary objects with a class of their own.
- Expose reflective links like object -> class and class -> metaclass.
- Define how method lookup walks superclass and metaclass chains.

The target here is not just “classes exist,” but “the runtime can explain itself from inside the language.”

### 5. Grow Cosm-authored tooling

- Improve `assert` and self-test conventions.
- Add a small Cosm-level test DSL once block/method passing is real.
- Expand the CLI to support running suites and reporting failures clearly.

## Ordering Notes

- Comments and interpolation help immediately, but they should not derail class/message work.
- Basic analysis should stay in service of the runtime model, not run ahead of it; richer type reasoning will get much clearer once message dispatch and class structure exist.
- Loops still remain a later feature until reassignment or a stronger immutable iteration story exists.
- A full object-dispatch replacement for evaluator type checks should wait until class and method lookup semantics are stable.

# Cosm Features

## Implemented Now

- Expressions with numeric arithmetic, comparisons, boolean logic, arrays, hashes, strings, and interpolation.
- Lexical `let` bindings, `do ... end` blocks, and `if ... then ... else ... end`.
- Stabby lambdas and named `def` functions with lexical closures.
- `class` definitions with inheritance, `def init(...)` constructors, reflective `.slots` and `.methods`, and instance creation through `Class.new(...)`.
- Instance methods with `self` and `@ivar` reads.
- Explicit class methods via `def self.name(...)`, reflected separately through `.classMethods`.
- Minimal per-class metaclasses, with `Class` as the bootstrap anchor for class-of-class reflection.
- Reflective class access through `classes`.
- Basic message send through `obj.method(...)`, including class objects as receivers.
- Primitive ownership beginning to move into TS runtime classes via native properties/methods such as numeric/string `plus` and string/array/hash `length`.
- Bun tests, direct runtime tests, a CLI runner, and `test/core.cosm` as a language-level smoke test.

## In Progress

- Converging the evaluator and runtime onto one consistent message-dispatch path.
- Deciding how far TS runtime values versus built-in Cosm classes should own primitive behavior during bootstrap, now that both sides exist.
- Extending the current bootstrap `Class` object into a fuller metaclass/class-of-class story.

## Next Likely Steps

- Extend class-side dispatch semantics deliberately.
- Move more operators and built-ins behind runtime/class dispatch.
- Add explicit object-state setup/writes once assignment semantics exist.
- Design the first reflective metaclass links.
- Design how namespaces/modules should fit into the reflective object model.
- Add a lightweight Cosm-native test harness on top of the current self-test loop.
- Prepare a small notebook/playground service and JS interop layer once dispatch/reflection are steady enough to expose.

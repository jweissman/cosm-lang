# Cosm Near-Term Plan

## What `0.3.13.x` Actually Landed

The `0.3.13.x` line ended up as one long runtime-identity push:

- `cosm test` as the normal Cosm-native spec path
- authored `BasicObject` / `Object` / `Module` / `Class` facades
- the collection lattice through `Collection`, `Enumerable`, `Sequence`, and `Mapping`
- block-first maintained Cosm code and spec DSL cleanup
- `nihil` plus explicit predicate/missing-value semantics
- a spec-first example corpus and explicit VM-supported corridor
- `Mirror` / `Hologram` reframing and first host-boundary proof
- a narrower dedicated agent CLI and better Cosm-native test UX
- explicit intrinsic ownership notes for the remaining TS-backed runtime seams

## What `0.3.13.38` Closes

- finish the visible object/reflection protocol enough to teach honestly
- make `methods` behave like the ordinary nullary surface instead of a reflective-table special case
- keep `method(:name)` / `classMethod(:name)` as the callable-identity path
- settle one concrete boundary proof:
  - `Mirror` over a host-backed HTTP object
  - `Hologram` over a JSON-shaped writable projection
- align docs so they describe the line that actually landed

## Next After `0.3.13.x`

`0.3.14.x` should begin with the explicit persistence/store boundary:

- introduce `Cosm::Store` as a named runtime seam
- likely back it with SQLite
- move notebook and agent durable state onto the same explicit store story
- only then reopen tools, Docker/sandboxing, and broader runtime orchestration

## Longer-Term Ideas Worth Preserving

- `~=` as the explicit semantic comparison seam and a later `~` structured-cast seam
- browser/runtime projection through reflective boundaries rather than browser-side Cosm execution
- host interop through shaped `Mirror` / `Hologram` boundaries rather than raw JS escape hatches
- tool/runtime objects and richer agent loops only after the store boundary is real

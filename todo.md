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

## What `0.3.13.39` Closes

- finish the visible object/reflection protocol enough to teach honestly
- keep `methods` behaving like the ordinary nullary surface without a fragile runtime lookup hack
- keep `method(:name)` / `classMethod(:name)` as the callable-identity path
- settle one concrete boundary proof:
  - `Mirror` over a host-backed HTTP object
  - `Hologram.project_json(...)` as an explicit JSON-shaped host-boundary projection helper
- make authored-vs-native method provenance visible through `origin`
- align docs so they describe the line that actually landed

## Next After `0.3.13.x`

`0.3.14.x` should begin by proving the thesis more directly:

- lead with one flagship intent-router example
- make `~=` and `as` the taught visible AI seam pair
- let notebook/examples/docs tell that story first
- only introduce `Cosm::Store` when the thesis program or notebook genuinely needs it

## Longer-Term Ideas Worth Preserving

- `~=` as the explicit semantic comparison seam and a later `~` structured-cast seam
- browser/runtime projection through reflective boundaries rather than browser-side Cosm execution
- host interop through shaped `Mirror` / `Hologram` boundaries rather than raw JS escape hatches
- tool/runtime objects and richer agent loops only after the store boundary is real

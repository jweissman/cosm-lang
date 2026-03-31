# Cosm Roadmap

## Current Read

Cosm is now best understood as:

- a language with visible AI seams in the JS runtime universe
- a notebook-first proving wedge for those seams
- a narrower secondary assistant/agent/service wedge
- a runtime increasingly explained by authored Cosm surfaces rather than only TS internals

The `0.3.13.x` line should now be read as one long consolidation arc:

- core tower and authored facades
- collection lattice and block-first style
- spec-first examples and a named VM corridor
- explicit `nihil` and clearer missing-value semantics
- first concrete host-boundary proof through `Mirror` / `Hologram`
- intrinsic ownership notes for the remaining TS-backed substrate

## What Is Real Now

- explicit `BasicObject` / `Object` / `Module` / `Class`
- real authored `cosm/core/*` facades over a TS-backed substrate
- explicit collection layering through `Collection`, `Enumerable`, `Sequence`, and `Mapping`
- message-native agent history and durable narrow Slack/local-chat wedges
- a spec-first example corpus shared by notebook teaching and the VM corridor
- explicit boundary objects through `Mirror`, `Cosm::Hologram`, `Schema`, `Data`, and `Cosm::AI`

## What `0.3.14.x` Starts Once The Thesis Code Is Real

- the thesis-first line:
  - one flagship intent-router example
  - `~=` plus `as` as the visible AI seam pair
  - notebook/examples/docs teaching Cosm through that program first
- keep the rest of the runtime work in service of the thesis rather than as endless prerequisite cleanup

## What Comes Next

### `0.3.14.x`: Thesis Pressure First

- tighten AI/runtime surfaces where the thesis program reveals awkwardness
- consider `Cosm::Store` only if the notebook or thesis examples truly need a stronger persistence seam
- keep host-boundary and runtime cleanup secondary unless it materially helps the flagship program

### After The Thesis Surface Is Calm

- explicit `Cosm::Store` boundary if it earns its keep
- tiny typed tool/runtime protocol
- Docker/sandboxing through explicit host-boundary objects rather than raw shelling
- richer agent runtime semantics only after the store boundary is calm

## Longer-Term Ideas Worth Preserving

- semantic operators as visible seams:
  `~=` now, `~` later
- runtime synchronization/browser projection through reflective boundaries
- host interop through shaped APIs rather than a broad raw JS bridge
- protocol-oriented composition for services, tools, and routers

## Explicit Non-Goals For Now

- full JS bridge before boundary semantics are calmer
- browser-side Cosm runtime
- generalized multi-agent/tool platform work before persistence is real
- broad VM parity or optimizer-first work

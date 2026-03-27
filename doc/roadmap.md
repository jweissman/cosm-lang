# Cosm Roadmap

## Product Direction

Cosm is a small reflective language for interactive tools and server-side applications in the JS runtime universe.

The long-running goals are:

1. A reflective OO core
   Real classes, metaclasses, modules, and explicit message send.
2. A small explicit standard surface
   `Kernel`, `classes`, `cosm`, `Schema`, `Data`, `Session`, and `cosm.ai` as real runtime roots.
3. A Cosm-authored platform layer
   Tests, support flows, prompt assembly, small app wiring, and eventually more of the user-facing workflow written in Cosm itself.
4. A credible VM target
   A send-first execution core that clarifies semantics before it tries to optimize them.
5. A narrow proving-app family
   Notebook is the flagship wedge, while CLI chat, `/assistant`, and the Slack agent service remain narrower secondary pressures on the same runtime.

## Current Tracks

### Language / Runtime Hardening

This is the main center of gravity.

Current priorities:

- keep shrinking interpreter-owned semantic policy
- keep explicit module bindings, real `Module` objects, and authored `cosm/core/*` facades legible in newer Cosm-authored code
- keep runtime dispatch, lookup, invocation, and block forwarding aligned
- keep reflection (`methods()`, `method(:name)`, `Kernel.dispatch(...)`, `yield(...)`) consistent with actual runtime behavior
- keep `Schema`, `Data`, and `cosm.ai` explicit rather than ambient

The success criterion is not “more syntax.” It is a smaller, cleaner semantic center.

### VM Track

The VM remains an opt-in, narrow subset.

Current priorities:

- keep `--trace-ir` and `--vm` useful for real debugging
- keep expanding the subset only where it overlaps with support/controller/app logic
- keep arithmetic/comparison and call/send behavior explainable from the same message-passing story the interpreter uses

The VM is still a down payment, not a second full runtime.

### Proving-App Track

The proving wedge is intentionally small, with one clear center:

- notebook
- CLI chat
- `/assistant`
- separate Slack agent service

Current priorities:

- keep the notebook as the main teaching and experimentation surface
- keep notebook flows centered on language exploration, saved pages, and runtime inspection
- keep the shared support/controller core explicit and Cosm-authored where practical
- keep the Slack service thin and secondary
- keep the notebook as a workbench, not a framework/product layer
- keep the app surfaces teaching the real runtime instead of implying larger hidden machinery

## Current Release Line

### `0.3.13.22`

This release is about stabilization, not breadth:

- settling the `BasicObject` / `Object` / `Module` / `Class` tower
- moving more visible protocol behavior into authored core facades
- stabilizing the `Collection` / `Enumerable` / `Sequence` / `Mapping` lattice
- sharpening the notebook as the current flagship wedge
- keeping the agent/tool runtime intentionally secondary and narrow
- making the VM story more honest through clearer parity fixtures and supported-subset docs

Explicitly not the goal of `0.3.13.x`:

- generalized persistent agent runtime
- MCP or broad tool ecosystems
- browser-side Cosm execution
- major notebook product expansion
- broad DSL syntax work
- full VM execution

## Milestones

### Milestone A: Cleaner MPI Core

- make `cosm.ts` smaller and less policy-heavy
- keep runtime dispatch the authoritative story for property lookup, send target resolution, access-call behavior, and invocation
- keep block lookup/forwarding and `yield(...)` aligned with that same story

### Milestone B: Better Cosm Authoring

- keep the authored `cosm/core/*` facades as the first place to look for ordinary object behavior
- keep the `Collection` / `Enumerable` / `Sequence` / `Mapping` lattice small and intentional
- move more support/spec/prompt logic into Cosm above the low-level runtime boundary

### Milestone C: Honest AI Boundary

- keep `cosm.ai.config()` / `status()` as config discovery
- keep `cosm.ai.health()` as the explicit probe
- keep `cosm.ai.stream(...)` explicit and documented honestly with respect to transport buffering vs true streaming

### Milestone D: Shared Interactive Tool Family

- notebook should remain the flagship wedge, with CLI chat, `/assistant`, and the Slack agent service as narrower secondary pressures
- keep one shared support/controller core
- keep persistence/session boundaries explicit and narrow

### Milestone E: Narrow VM Legibility

- keep the VM subset overlapping with real support/controller/app logic
- keep traces useful enough to explain runtime behavior
- avoid broadening into optimizer or browser-runtime ambitions too early

## What Feels Real Already

- `BasicObject`, `Object`, `Module`, `Class`, and reflective modules
- message send and explicit helper dispatch
- `Kernel`, `Session`, `Schema`, `Data`, and `cosm.ai`
- object-first HTTP routing and `.ecosm` templates
- a server-side notebook workbench
- a pure Cosm support-chat loop
- a tiny page-backed assistant wedge
- a live DM-first Slack service with durable thread-local state

## What Still Feels Provisional

- broader CLI UX such as readline-style history
- a fuller VM subset
- host interop beyond the current narrow runtime values
- broader module/DSL syntax
- any larger persistent agent/runtime story beyond narrow DM persistence

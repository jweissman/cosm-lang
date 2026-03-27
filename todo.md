# Cosm Near-Term Plan

## What `0.3.13.x` Actually Landed

The `0.3.13.x` line ended up being three overlapping arcs rather than a neat linear patch plan.

### 1. Runtime / CLI Legitimacy

Largely landed:

- `cosm test ...` as a first-class CLI mode
- implicit spec helpers in test mode
- no explicit `finish()` requirement in normal spec flow
- clearer VM parity wedge and smoke fixtures
- better trace/debug surfaces
- split bootstrap, smaller parser responsibilities, documented call flow
- runtime tests split by subsystem instead of one omnibus runtime file

### 2. Agent / Memory / Service Legitimacy

Largely landed in a narrow form:

- one obvious agent runtime path
- local chat harness
- DM-first Slack service
- mention/thread channel ingress
- durable message-native conversation history
- thread-local durable state
- status/diagnostic commands and HTTP surfaces

Still intentionally deferred:

- real tool runtime
- broader concurrency/runtime orchestration
- larger persistent agent platform story

### 3. OO / Authored Surface Legitimacy

Substantially landed:

- explicit `BasicObject` / `Object` / `Module` / `Class` tower
- authored `cosm/core/*` class facades
- explicit collection lattice through `Collection`, `Enumerable`, `Sequence`, and `Mapping`
- authored includes for `Array` / `Hash`
- method-send trailing blocks
- more maintained Cosm code reading in a more block-first style

Still partial:

- object protocol cleanup
- reducing remaining mystery native behavior
- further stdlib lifting into authored Cosm code

## Current Open Debts

### Object Protocol

- finish `inspect`, `to_s`, `method`, and `methods` cleanup
- keep clarifying what belongs on `BasicObject` vs `Object`
- reduce visible behavior that still only really lives in TS

### Boundary Semantics

- define `Mirror` and `Hologram` more crisply
- sharpen host-backed value translation
- make AI casting/comparison feel like principled runtime boundaries
- decide how `~=` / `~` fit into the language model

### Persistence

- move from wedge storage under `var/` toward a real store boundary
- likely SQLite
- make replay/status/debug much easier

### Blocks and Callables

- keep converting maintained Cosm code to trailing blocks where natural
- keep explicit lambdas where they are the right tool:
  - stored callbacks
  - AI/streaming handlers
  - identity-sensitive callable objects

### Invocation Context

- the runtime hook boundary now normalizes through an explicit invocation context
- finish migrating more native/runtime-backed internals to use that model directly instead of relying on compatibility normalization

## Next Milestones

### `0.3.13.26`: Canonicalization and Object Protocol

- finish `inspect` / `to_s` / `method` / `methods` cleanup
- keep shrinking TS-owned visible behavior into authored Cosm
- keep docs/roadmap/vision aligned with current reality

### `0.3.13.27`: Boundary Semantics

- define what `Mirror` and `Hologram` really are
- sharpen host-backed value translation rules
- decide whether `~=` / `~` become the canonical visible semantic seam
- make the AI boundary feel as principled as HTTP/class reflection

### `0.3.13.28`: Persistence and Runtime State

- introduce a real store boundary
- likely SQLite
- better replay/status/debuggability
- keep notebook and agent memory on the same explicit persistence story

### `0.3.13.29`: Tool / Concurrency Wedge

- tiny typed tool protocol
- only after persistence and boundary semantics are clearer
- possibly a first structured-concurrency down payment if the runtime needs it

## Longer-Term Ideas Worth Protecting

- neurosymbolic operators as visible language seams
- runtime synchronization between server and browser through reflective boundaries
- JS interop through shaped APIs rather than raw host objects
- protocol-oriented composition for tools/services/routers
- scoped living object persistence

# Cosm Roadmap

## Current Read

Cosm is now best understood as:

- a small reflective OO language in the JS runtime universe
- a notebook-first proving wedge
- a narrow secondary agent/service wedge
- a runtime that is increasingly explained by authored Cosm surfaces instead of only TS internals

The `0.3.13.x` line did not land as a neat sequence of isolated patch goals. It landed as three overlapping arcs:

1. Runtime and CLI legitimacy
2. Agent/message/state legitimacy
3. OO/core-surface legitimacy

That overlap is fine, but the roadmap should describe what is true now rather than preserving every older planned patch number.

## What Feels Real Already

- explicit `BasicObject` / `Object` / `Module` / `Class` tower
- real authored `cosm/core/*` class facades over a TS-backed substrate
- explicit collection lattice through `Collection`, `Enumerable`, `Sequence`, and `Mapping`
- method-send trailing blocks for normal collection-style sends
- reflective runtime roots through `Kernel`, `Process`, `Time`, `Random`, `Schema`, `Data`, `Prompt`, `Session`, and `Cosm::AI`
- a clearer `BasicObject` versus `Object` teaching split, with the notebook centered on the everyday object protocol
- message-native agent history and durable thread-local state
- DM-first Slack service plus mention/thread channel ingress
- notebook as the main teaching and experimentation surface
- a narrow VM parity wedge with explicit smoke fixtures
- split bootstrap, smaller parser responsibilities, subsystem runtime tests, and a documented runtime call flow
- a spec-first executable example corpus that notebook and VM work can derive from

## What Is Still Partial

- object protocol paydown:
  `inspect`, `to_s`, `method`, `methods`, and some reflection/equality behavior still rely on too much native substrate knowledge
- block-native style:
  supported and increasingly idiomatic, but maintained Cosm code still contains more explicit lambdas than the long-term style should
- invocation context migration:
  the runtime hook boundary now normalizes through an explicit context object, but many native method bodies still use the older positional style internally
- persistence:
  durable state is still file-backed wedge storage under `var/`, not a real store boundary
- boundary semantics:
  `Mirror`, `Hologram`, AI casting, and host-backed value translation now have a first clearer runtime story, but they still need deeper consolidation before semantic operators or broad interop
- broader tool/runtime work:
  intentionally deferred while the language/runtime story stabilizes

## Product Direction

### Flagship Wedge

The flagship wedge remains the notebook.

Why:

- it teaches the language directly
- it pressures reflection, sessions, rendering, and persistence
- it keeps the runtime honest without forcing a framework/product story too early

### Secondary Wedges

These remain real, but intentionally narrower:

- local CLI chat
- `/assistant`
- Slack-facing agent service

Those wedges are useful because they pressure:

- message-native memory
- structured turn records
- explicit AI boundaries
- transport/runtime separation

But they should not currently drive the whole language design.

## Current Tracks

### 1. Runtime Hardening

Current priority:

- keep shrinking interpreter-owned semantic policy
- keep bootstrap, dispatch, invoke, and lookup boundaries explicit
- keep authored core facades as the first place to look for visible object behavior
- keep runtime tests and docs aligned with that story

### 2. Object Protocol Paydown

Current priority:

- finish clarifying what belongs on `BasicObject`, `Object`, `Module`, and `Class`
- reduce mystery native behavior in text/reflection/equality protocol surfaces
- keep lifting stable visible behavior into authored Cosm code

### 3. Boundary Semantics

Current priority:

- define `Mirror` and `Hologram` more crisply
- make host-backed value translation rules explicit
- keep `Schema`, `Data`, and `Cosm::AI` predictable and explicit
- decide how semantic operators like `~=` / `~` fit into the model

### 4. Persistence and Runtime State

Current priority:

- move from wedge storage toward a real store boundary
- improve replay, inspection, and debugability
- keep message-native history and structured runtime state explicit

### 5. Narrow VM Legibility

Current priority:

- keep the VM useful for parity/debugging
- expand only where it overlaps with maintained core/notebook/support code and the executable example corpus
- avoid pretending it is already the default runtime

## Near-Term Milestones

### `0.3.13.33`: Architectural Boundary Pass and Tooling Consolidation

- keep the Bun/HTTP host-object proof in place while explicitly classifying current HTTP wrappers as substrate, transitional wrappers, or longer-lived Cosm policy surfaces
- split Slack diagnostics and operational commands out of `bin/cosm` so the main CLI stays language/runtime-first
- add a tiny `expect(...)` surface and better Cosm-native failure output without replacing `assert` / `assert_equal`
- keep docs/notebook/examples consistent about `Mirror`/`Hologram` as the path for shrinking bespoke TS-native boundary types over time

### `0.3.14.x`: Persistence, Tools, and Concurrency

- introduce a real store boundary
- likely move durable runtime state toward SQLite
- make replay / status / debug more legible
- keep notebook and agent memory on the same explicit persistence story
- add a tiny typed tool protocol only after persistence/boundary work is clearer
- keep the agent loop explicit and message-native
- consider a first small structured-concurrency down payment if the agent/tool runtime needs it

## Longer-Term Ideas Worth Preserving

- neurosymbolic operators as first-class visible seams:
  `~=` for semantic comparison, `~` for AI-guided structured cast
- runtime synchronization rather than just data synchronization:
  notebook/browser projections driven through reflective runtime state
- host interop through shaped boundaries, not raw JS escape hatches
- protocol-oriented composition for tools/services/routers
- living runtime-state persistence in a scoped, explicit form

## Explicit Non-Goals For Now

- broad browser-side Cosm execution
- generalized multi-agent/tool platform work before the runtime/persistence story is calmer
- full JS interop bridge before `Mirror` / `Hologram` semantics are explicit
- full VM parity or optimizer-first work
- large notebook product expansion before the language/runtime semantics settle

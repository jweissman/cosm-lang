# Intrinsic Ownership

`0.3.13.36`-`0.3.13.38` close out the language push by making intrinsic ownership explicit instead of leaving it as “whatever is still in TS.”

## Ownership Rule

- If behavior is ordinary semantic policy and can be expressed in Cosm without circular bootstrap pain, lift it into authored Cosm.
- If behavior is host integration, process/runtime boundary handling, or bootstrap substrate, keep it in TS.
- If behavior is HTTP transport shape, keep it transitional for now and document that honestly.

## Current Classification

- `Kernel`
  Substrate-native. Keep host IO, filesystem, process shelling, JSON parsing, and runtime hooks in TS. Prefer authored Cosm wrappers for policy and ergonomics.
- `Process`, `Time`, `Random`
  Substrate-native. These are direct host/runtime primitive boundaries.
- `Schema`, `Prompt`
  Substrate-native runtime cores with authored policy above them. `Data` and `Cosm::AI` are the preferred semantic layers.
- `Session`
  Substrate-native because worker-backed isolation and evaluation transport still live in TS.
- `Http`
  Transitional TS substrate object for transport/bootstrap plus host-backed proofs like `http.headers(...)`.
- `HttpRequest`, `HttpResponse`
  Transitional wrappers over host transport shape, not the final interop story.
- `HttpRouter`
  Cosm-facing policy surface. Routing intent is more likely to stay Cosm-authored than raw request/response transport shape.
- `Mirror`, `Hologram`
  Host-boundary/runtime substrate in TS, with authored examples/docs defining the taught semantics above that layer.

## Practical Goal

The short-term goal is not to “lift everything.” It is to make `cosm/core/*` the obvious home for everyday object/class/module/collection semantics while shrinking the amount of visible behavior that still feels mysterious or accidentally native.

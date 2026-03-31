# HTTP Boundary Notes

`0.3.13.40` still treats the current HTTP runtime as a mixed boundary rather than a final design.

## Current Classification

- `Http`
  TS-backed substrate object for Bun service startup, request bridging, and the first host-object proof through `http.headers(...)`.
- `HttpRequest`
  Transitional wrapper. It keeps the current handler surface stable, but it should not be read as proof that Cosm must permanently own request primitives in TS.
- `HttpResponse`
  Transitional wrapper. It is still the everyday response surface today, but longer-term response shaping may move toward more authored Cosm policy plus host-backed adaptation where that stays clean.
- `HttpRouter`
  Cosm-facing policy surface. This is the HTTP piece most likely to remain Cosm-authored longest because it expresses routing intent rather than raw transport substrate.

## Rule Of Thumb

- Cosm should own semantics, policy, routing, and reflective orchestration.
- Bun or other host runtimes should own transport primitives where `Mirror` and `Hologram` can wrap them cleanly.
- TS-native wrappers should stay only where Cosm still needs a stable substrate seam.

## Near-Term Direction

- keep the existing `HttpRequest` / `HttpResponse` / `HttpRouter` runtime objects intact
- continue proving host-backed wrapping through Bun/HTTP-adjacent objects
- avoid adding new bespoke TS-native HTTP boundary types unless there is no cleaner host-wrapped path

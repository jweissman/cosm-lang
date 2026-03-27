# Runtime Call Flow

Cosm's runtime call path is intentionally split across a few small subsystems.

## Ownership

- `RuntimeDispatch`
  Owns lookup and message resolution.
  It answers questions like:
  - "what property does this receiver expose?"
  - "what method resolves for this symbol?"
  - "if this access target is callable, what should be invoked?"
  - "what does `super` resolve to from this owner token?"

- `InterpreterInvoke`
  Owns call evaluation and function activation.
  It:
  - evaluates call arguments
  - threads the current trailing block into the call
  - builds function call environments
  - handles `yield`
  - handles `super(...)` by asking `RuntimeDispatch` for the target

- `InterpreterMessage`
  Owns traced send-style entrypoints.
  It is the narrow adapter that wraps "send this message to that receiver" and "invoke this callable" with debug-friendly trace output.

- `InterpreterLookup`
  Owns name, constant, and ivar binding lookup.

## Property Lookup vs Send vs Invocation

- Property lookup:
  `RuntimeDispatch.lookupProperty(...)`
  Used for `receiver.name`-style access.

- Send:
  `RuntimeDispatch.send(...)`, usually reached through `InterpreterMessage.send(...)`
  Resolves a named method on a receiver and invokes it.

- Invocation:
  `InterpreterInvoke.invokeFunction(...)`
  Calls a callable value after lookup has already happened.

## Access-Call Fallback

For an expression like `receiver.handler(...)`, the runtime:

1. looks up `handler` on `receiver`
2. if it resolves to a method, that method is invoked with `receiver` as self
3. if it resolves to a callable property, `RuntimeDispatch.invokeAccessCall(...)` passes that callable into `InterpreterInvoke.invokeFunction(...)`

That split is why access and send share resolution logic but still have separate call paths.

## Blocks and `yield`

- trailing blocks are attached during parsing/lowering and become a callable argument
- `InterpreterInvoke` marks that callable as the current block for the invoked function
- `yield(...)` walks the current environment chain to find that block and re-invokes it

## `super`

`InterpreterInvoke.evalSuper(...)` finds the current method context from the env, then asks:

- `RuntimeDispatch.resolveSuperTarget(...)`

to locate the next implementation in the owner chain. Invocation then proceeds through the normal function path.

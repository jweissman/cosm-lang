# VM Corridor

`0.3.13.40` still treats the VM as a maintained execution target for a named subset, not as an experimental second runtime for arbitrary Cosm code.

## Supported Corridor

- literals
- `let` and reassignment
- `if`
- block/scoped statements
- arrays and hashes
- property access
- ordinary method sends
- access-call
- the explicit `Examples::Spec.vm_supported()` corpus subset

## Explicitly Out

- agent runtime
- HTTP server/runtime transport
- worker/session substrate
- AI/network behavior
- arbitrary parity chasing outside the maintained corpus subset

## Source Of Truth

The canonical supported programs are the examples returned by `Examples::Spec.vm_supported()`.

That subset is tested in:

- `test/vm.test.ts`
- `test/examples_corpus.test.ts`
- `just vm-corpus-test`

The VM should expand only when maintained authored core/examples actually require it.

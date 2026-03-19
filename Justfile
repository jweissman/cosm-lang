test: ts-test

ts-test:
  bun test --watch

self-test:
  cosm test/core.cosm

repl:
  cosm

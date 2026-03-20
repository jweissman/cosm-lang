test: ts-test

ts-test:
  bun test --watch

http-test:
  COSM_HTTP_INTEGRATION=1 bun test test/http.integration.test.ts

lint:
  bun run lint

lint-fix:
  bun run lint:fix

self-test:
  cosm test/core.cosm

repl:
  cosm

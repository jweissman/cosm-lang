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
  cosm spec/core.cosm

repl:
  cosm

server:
  bun bin/cosm --watch app/server.cosm

watch-server:
  bun bin/cosm --watch app/server.cosm

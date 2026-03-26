set shell := ["zsh", "-lc"]

dev-bun := "./script/bunx"

test: ts-test

ts-test:
  {{dev-bun}} test --watch

http-test:
  COSM_HTTP_INTEGRATION=1 {{dev-bun}} test test/http.integration.test.ts

lint:
  {{dev-bun}} run lint

lint-fix:
  {{dev-bun}} run lint:fix

self-test:
  {{dev-bun}} bin/cosm spec/core.cosm

repl:
  {{dev-bun}} bin/cosm

server:
  {{dev-bun}} bin/cosm app/server.cosm

watch-server:
  {{dev-bun}} bin/cosm --watch app/server.cosm

agent-server:
  {{dev-bun}} bin/cosm agent/server.cosm

watch-agent-server:
  {{dev-bun}} bin/cosm --watch agent/server.cosm

send-dm target text:
  {{dev-bun}} bin/cosm agent/send_dm.cosm {{target}} {{text}}

bench-vm:
  {{dev-bun}} run script/bench_vm.ts

chat:
  {{dev-bun}} bin/cosm support/chat_cli.cosm

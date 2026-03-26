set shell := ["zsh", "-lc"]

dev-bun := "./script/bunx"

test: fast-test

fast-test:
  {{dev-bun}} run test:fast

watch-test:
  {{dev-bun}} test --watch

slow-test:
  {{dev-bun}} run test:slow

http-test:
  COSM_HTTP_INTEGRATION=1 {{dev-bun}} test test/http.integration.slow.ts

live-ai-test:
  COSM_AI_LIVE=1 {{dev-bun}} test test/ai.integration.test.ts

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

send-dm channel_id text:
  {{dev-bun}} bin/cosm agent/send_dm.cosm {{channel_id}} {{text}}

bench-vm:
  {{dev-bun}} run script/bench_vm.ts

chat:
  {{dev-bun}} bin/cosm agent/chat_cli.cosm

commit:
  git add .
  git commit -m "v$(cosm --version)"
  git tag "$(cosm --version)"

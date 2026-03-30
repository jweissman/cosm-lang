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
  COSM_HTTP_INTEGRATION=1 {{dev-bun}} test test/http.integration.test.ts

live-ai-test:
  COSM_AI_LIVE=1 {{dev-bun}} test test/ai.integration.test.ts

test-all: slow-test http-test live-ai-test fast-test

lint:
  {{dev-bun}} run lint

lint-fix:
  {{dev-bun}} run lint:fix

self-test:
  {{dev-bun}} bin/cosm test spec/

repl:
  {{dev-bun}} bin/cosm

server:
  {{dev-bun}} bin/cosm lib/app/server.cosm

watch-server:
  {{dev-bun}} bin/cosm --watch lib/app/server.cosm

agent-server:
  {{dev-bun}} bin/cosm lib/agent/server.cosm

watch-agent-server:
  {{dev-bun}} bin/cosm --watch lib/agent/server.cosm

send-dm channel_id text:
  {{dev-bun}} bin/cosm lib/agent/send_dm.cosm {{channel_id}} {{text}}

bench-vm:
  {{dev-bun}} run script/bench_vm.ts

vm-corpus-test:
  {{dev-bun}} test test/vm.test.ts test/examples_corpus.test.ts

chat:
  {{dev-bun}} bin/cosm lib/agent/chat_cli.cosm

commit:
  git add .
  git commit -m "v$(cosm --version)"
  git tag "$(cosm --version)"

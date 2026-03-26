#!/usr/bin/env zsh

set -euo pipefail

files=(
  test/agent_runtime.test.ts
  test/ai_schema.test.ts
  test/chatbot.test.ts
  test/cli.test.ts
  test/cosm.test.ts
  test/data_model.test.ts
  test/dispatch_runtime.test.ts
  test/object_protocol.test.ts
  test/parser.test.ts
  test/requests/service_request_spec.test.ts
  test/session.test.ts
  test/slack.test.ts
  test/templates.test.ts
  test/types.test.ts
  test/vm.test.ts
)

./script/bunx test "${files[@]}"

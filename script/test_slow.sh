#!/usr/bin/env zsh

set -euo pipefail

./script/bunx test ./test/requests/notebook_request_spec.slow.ts
COSM_HTTP_INTEGRATION=1 ./script/bunx test ./test/http.integration.slow.ts

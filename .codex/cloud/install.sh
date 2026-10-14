#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
node -e 'if (Number(process.versions.node.split(".")[0]) !== 24) { console.error("Use Node.js 24 for this development environment."); process.exit(1); }'
node scripts/codex-cloud-checks.mjs preflight
npm ci --no-audit --no-fund
npm --prefix functions ci --no-audit --no-fund
node scripts/codex-cloud-checks.mjs preflight
printf '%s\n' 'Locked dependencies installed. Run: node scripts/codex-cloud-checks.mjs portable'

#!/bin/bash
# Installs npm packages at the start of Claude Code cloud sessions so tests and
# typechecks can run. Does nothing on a local machine.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# Nothing to install until the app is scaffolded.
if [ ! -f package.json ]; then
  exit 0
fi

if [ -f package-lock.json ]; then
  # Skip the install when node_modules already matches the lockfile.
  lock_hash=$(sha256sum package-lock.json | cut -d' ' -f1)
  if [ -f node_modules/.lock-hash ] && [ "$(cat node_modules/.lock-hash)" = "$lock_hash" ]; then
    exit 0
  fi
  npm ci --no-audit --no-fund >&2
  echo "$lock_hash" > node_modules/.lock-hash
else
  npm install --no-audit --no-fund >&2
fi

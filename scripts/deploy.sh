#!/bin/sh
# The Workers Builds deploy command, run as `npm run deploy` on every push to
# main (README.md, "Deploying"). Never run it from a session (CLAUDE.md rule 7).
set -eu

# Names only, never values, to show which Cloudflare settings the build has.
echo "Cloudflare variables in this build: $(env | grep -oE '^(CLOUDFLARE|CF)_[A-Z0-9_]*' | sort | tr '\n' ' ')"

if [ -n "${DEPLOY_API_TOKEN:-}" ]; then
  echo "Using the API token in the DEPLOY_API_TOKEN build secret."
  export CLOUDFLARE_API_TOKEN="$DEPLOY_API_TOKEN"
else
  echo "Using the token Workers Builds provides."
fi

wrangler d1 migrations apply DB --remote
wrangler deploy

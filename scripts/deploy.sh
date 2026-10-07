#!/bin/sh
# The Workers Builds deploy command, run as `npm run deploy` on every push to
# main (README.md, "Deploying"). Never run it from a session (CLAUDE.md rule 7).
set -eu

# Names only, never values, to show which Cloudflare settings the build has.
echo "Cloudflare variables in this build: $(awk 'BEGIN { for (k in ENVIRON) if (k ~ /^(CLOUDFLARE|CF)_/) print k }' | sort | tr '\n' ' ')"

# API tokens contain no whitespace, so a pasted newline or space is dropped.
token=$(printf '%s' "${DEPLOY_API_TOKEN:-}" | tr -d '[:space:]')
if [ -n "$token" ]; then
  echo "Using the API token in the DEPLOY_API_TOKEN build secret."
  export CLOUDFLARE_API_TOKEN="$token"
else
  echo "Using the token Workers Builds provides."
fi

wrangler d1 migrations apply DB --remote || {
  echo "Applying the D1 migrations failed. If the error above is an authentication error, see README.md, \"Deploying\", step 5." >&2
  exit 1
}
wrangler deploy

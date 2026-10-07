#!/bin/sh
# The Workers Builds deploy command, run as `npm run deploy` on every push to
# main (README.md, "Deploying"). Never run it from a session (CLAUDE.md rule 7).
set -eu

# Names only, never values, to show which Cloudflare settings the build has.
# These are the ones that decide which token Wrangler uses and where its API
# calls go.
echo "Cloudflare, Wrangler and proxy variables in this build: $(awk 'BEGIN { for (k in ENVIRON) if (k ~ /^(CLOUDFLARE|CF|WRANGLER|WORKERS)_/ || tolower(k) ~ /^(https?|no|all)_proxy$/) print k }' | sort | tr '\n' ' ')"

# API tokens contain no whitespace, so a pasted newline or space is dropped.
# The log gets the token's length and what was dropped, never its value.
raw=${DEPLOY_API_TOKEN:-}
token=$(printf '%s' "$raw" | tr -d '[:space:]')
if [ -n "$token" ]; then
  echo "Using the API token in the DEPLOY_API_TOKEN build secret: ${#token} characters, after removing $((${#raw} - ${#token})) whitespace characters."
  case $token in
    *[![:alnum:]_-]*) echo "Warning: DEPLOY_API_TOKEN contains characters an API token never has (only letters, digits, _ and - are expected). Copy the token again; see README.md, \"Deploying\", step 5." >&2 ;;
  esac
  export CLOUDFLARE_API_TOKEN="$token"
else
  echo "Using the token Workers Builds provides."
fi

wrangler d1 migrations apply DB --remote || {
  echo "Applying the D1 migrations failed. If the error above is an authentication error, see README.md, \"Deploying\", step 5." >&2
  exit 1
}
wrangler deploy

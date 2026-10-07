# Chess Themed Challenges

A mobile web app for a chess-themed pub crawl: each player gets a secret challenge and a decoy, accuses other players, and is scored at the reveal.

## Running it locally

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev        # http://localhost:8787
npm test
npm run typecheck
```

The spec is [`docs/scope.md`](docs/scope.md) and the build plan is [`docs/phases.md`](docs/phases.md).

## Deploying

Every push to `main` deploys the app through Cloudflare Workers Builds; nothing is deployed by hand. Workers Builds installs the packages and runs `npm run deploy`, which applies any new D1 migrations to the production database and then runs `wrangler deploy`. Wrangler runs `scripts/copy-vendor.mjs` before deploying, and finds the production database by its name, `chess-crawl`. CI's `check` job also builds the Worker without uploading it (`wrangler deploy --dry-run`), so a change that can't deploy fails before it reaches `main`.

The live app is at `https://chess-themed-challenges.<your-subdomain>.workers.dev`, shown on the Worker's page in the Cloudflare dashboard.

### One-time setup (Danny, in the Cloudflare dashboard)

Do these in order, all on the free plan.

1. **Database.** Go to **Storage & databases > D1** and create a database named exactly `chess-crawl`. For location, pick Western Europe if asked.
2. **Worker.** Go to **Workers & Pages > Create application**, start from the Hello World template, name it exactly `chess-themed-challenges`, and deploy it. The first real deploy replaces it.
3. **Secrets.** On that Worker, go to **Settings > Variables and Secrets** and add two values of type **Secret**:
   - `HOST_PASSWORD`: the password for the host page. Pick something you can type on your phone.
   - `COOKIE_SECRET`: a long random string, at least 32 characters, for example from a password manager. Nobody ever types it.
4. **Connect the repository.** On the Worker, go to **Settings > Builds > Connect**, choose GitHub and `DannyOPREA/Chess-Themed-Challenges`, and set:
   - Branch: `main`
   - Build command: leave empty
   - Deploy command: `npm run deploy`
   - Root directory: leave empty
   - API token: create a new token
   - Preview builds (builds for branches other than `main`): off, because previews would use the production database
5. **Let the build token use D1.** The token Workers Builds just created can deploy Workers but can't touch D1, which applying migrations needs. Go to **My Profile > API Tokens**, edit that token (its name is shown under **Settings > Builds**), add the permission **Account > D1 > Edit**, and save.
6. **First deploy.** The next push to `main` builds and deploys the app; the build log is under the Worker's **Deployments** tab. A build that ran before step 5 was done fails on D1, and the next one works.

To change the host password later, edit `HOST_PASSWORD` under **Settings > Variables and Secrets**. It takes effect at once, without a deploy.

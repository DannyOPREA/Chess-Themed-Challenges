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

## Host page

The host page is at `/host`. The browser asks for a user name and password: any user name works, and the password is the `HOST_PASSWORD` secret (`local-host-password` when running locally). From there the host moves the game through its phases, fixes completions, resets PINs, removes players and shows the join QR code.

## Deploying

Every push to `main` deploys the app through Cloudflare Workers Builds; nothing is deployed by hand. Workers Builds installs the packages and runs `npm run deploy`, which applies any new D1 migrations to the production database and then runs `wrangler deploy`. Both use the API token in the build secret `DEPLOY_API_TOKEN` (step 5), and the deploy stops with a message naming it if it isn't set, because the token Workers Builds creates for itself can't use D1 and can't be given that permission. Wrangler runs `scripts/copy-vendor.mjs` before deploying, and finds the production database by its name, `chess-crawl`. CI's `check` job also builds the Worker without uploading it (`wrangler deploy --dry-run`), so a change that can't deploy fails before it reaches `main`.

The live app is at `https://chess-themed-challenges.<your-subdomain>.workers.dev`, shown on the Worker's page in the Cloudflare dashboard.

### One-time setup (Danny, in the Cloudflare dashboard)

Do these in order, all on the free plan.

1. **Database.** Go to **Storage & databases > D1** and create a database named exactly `chess-crawl`. For location, pick Western Europe if asked.
2. **Worker.** Go to **Workers & Pages > Create application**, start from the Hello World template, name it exactly `chess-themed-challenges`, and deploy it. The first real deploy replaces it. If Cloudflare asks you to choose a `workers.dev` subdomain, any name will do; it becomes part of the app's address.
3. **Secrets.** On that Worker, go to **Settings > Variables and Secrets** and add two values of type **Secret**:
   - `HOST_PASSWORD`: the password for the host page. Pick something you can type on your phone.
   - `COOKIE_SECRET`: a long random string, at least 32 characters, for example from a password manager. Nobody ever types it.
4. **Connect the repository.** On the Worker, go to **Settings > Builds > Connect**, choose GitHub and `DannyOPREA/Chess-Themed-Challenges`, and set:
   - Branch: `main`
   - Build command: leave empty
   - Deploy command: `npm run deploy`
   - Root directory: leave empty
   - API token: create a new token
   - Preview builds (builds for branches other than `main`): off. They would fail, because the app has no preview settings, and nobody needs them. If the option isn't shown here, turn off **Enable Preview Builds** under **Settings > Builds > Branch control** afterwards.
5. **A token that can use D1.** Applying migrations needs D1, which the token Workers Builds creates can't use or be given. Make one that can:
   - Go to **My Profile > API Tokens** (https://dash.cloudflare.com/profile/api-tokens), click **Create Token**, and choose **Use template** next to **Edit Cloudflare Workers**.
   - Under Permissions, click **+ Add more** and pick **Account > D1 > Edit**. Under Account Resources pick your account, and under Zone Resources pick All zones.
   - Click **Continue to summary**, then **Create token**, and copy the token it shows (it's shown only once). If you lose it or roll it later, put the new value in `DEPLOY_API_TOKEN` too, or deploys stop.
   - On the Worker, go to **Settings > Builds > Variables and secrets** (the build's own settings, not the Worker's Variables and Secrets page) and add a **Secret** named `DEPLOY_API_TOKEN` with that token as its value. Leave the API token setting as it is.
6. **First deploy.** Builds and their logs are under the Worker's **Deployments** tab. If a build started when you connected the repository, it fails because step 5 wasn't done yet: open it and retry it. If the retry fails the same way, the next merge to `main` starts a fresh build that picks up the secret. Otherwise the next push to `main` builds and deploys the app, and Claude merges to `main` often. Once a build succeeds, the Worker's page shows its `workers.dev` address; open it on your phone and you should see the app's start page.

To change the host password later, edit `HOST_PASSWORD` under **Settings > Variables and Secrets**. It takes effect at once, without a deploy. Don't change `COOKIE_SECRET` during a game: it logs every player out, and they have to rejoin with their name and PIN.

### Migrations reach the live database on their own

`npm run deploy` applies new migrations a moment before the new code goes live, so for a few seconds, or until the next push if the deploy step fails, the previous code runs against the new schema. Keep migrations additive (new tables and columns) so the previous code still works. Check the SQL `npm run db:generate` writes: a migration that rebuilds a table (`PRAGMA foreign_keys=OFF`, then `__new_<table>`) is not safe on D1, which ignores that pragma, so dropping the old table deletes or blocks the rows that reference it. A unit that needs one says so in its plan and tries it on the local D1, with data in it, first.

# Phase 1, unit 01: Scaffold

- Status: Done
- Log: [logs/phase-1-foundation/01-scaffold.md](../../logs/phase-1-foundation/01-scaffold.md)
- Depends on: nothing

## Goal

The empty app that runs locally and in CI, on the agreed stack, with the folder layout and conventions the later units share, so that units 1.02, 1.03, 2.01 and 2.02 can be built in parallel without touching the same lines.

## Scope references

- `docs/phases.md`, unit 1.01.
- `CLAUDE.md`: the stack, the required npm script names, rule 1 (reuse before writing), rule 4 (`CONTENT_SET` starts as `test`), rule 7 (never deploy from a session).
- `docs/scope.md`, "Hosting and tech": Cloudflare Workers and D1 on the free plan.

## Work

1. `package.json` with every package in the agreed stack, so later units don't each edit the lockfile:
   - runtime: `hono`, `drizzle-orm`, `zod`, `@hono/zod-validator`, `uqr`, `@picocss/pico`, `htmx.org`
   - development: `wrangler`, `drizzle-kit`, `typescript`, `vitest` (4.1, the version the Workers plugin supports), `@cloudflare/vitest-plugin` (the new name of `@cloudflare/vitest-pool-workers`)
2. The npm scripts `CLAUDE.md` names, plus one for generated types:
   - `dev`: `wrangler dev` (local Worker with a local D1)
   - `test`: `vitest run`
   - `typecheck`: `tsc --noEmit`
   - `db:generate`: `drizzle-kit generate`
   - `db:migrate:local`: `wrangler d1 migrations apply DB --local`
   - `cf-typegen`: `wrangler types --strict-vars=false`, which regenerates `worker-configuration.d.ts` (the `Env` type and the Workers runtime types). Rerun it after any change to `wrangler.jsonc` and commit the result.
3. `wrangler.jsonc`:
   - the Worker `chess-themed-challenges`, entry `src/index.ts`, observability on
   - the D1 binding `DB` (database `chess-crawl`, migrations in `migrations/`). It has no `database_id` yet; unit 1.03 sets up the production database.
   - the var `CONTENT_SET` set to `test`
   - the two secrets declared by name, `HOST_PASSWORD` (host page, unit 3.04) and `COOKIE_SECRET` (signed cookies, unit 3.01), so they are typed in `Env`. Local values come from a git-ignored `.dev.vars` (copy `.dev.vars.example`), test values from `vitest.config.ts`, and production values from the Cloudflare dashboard (unit 1.03).
   - Workers static assets from `public/`, and a build step (`scripts/copy-vendor.mjs`) that copies Pico CSS and htmx from `node_modules` into `public/vendor/` (git-ignored) before `wrangler dev` and `wrangler deploy`
4. The shared page layout `src/layout.tsx` (a `jsxRenderer`): phone viewport, Pico CSS, htmx, a `<main class="container">`, and a `title` passed as `c.render(content, { title })`.
5. `src/index.ts`: the Hono app with `secureHeaders()` (referrer policy `same-origin`, so form posts keep their `Origin`), `csrf()` and the layout, one `app.route()` line per screen, and the shared error pages.
6. A placeholder start page at `/` (`src/routes/home.tsx`), which unit 3.01 replaces with the join page.
7. Shared error pages (`src/routes/errors.tsx`): a 404 page and a 500 page in the layout, each with a link back to `/`.
8. Drizzle: `drizzle.config.ts` (SQLite dialect, schema `src/db/schema.ts`, migrations out to `migrations/`), an empty schema for unit 1.02 to fill, and `createDb(c.env.DB)` in `src/db/client.ts`.
9. Vitest with `@cloudflare/vitest-plugin` (`vitest.config.ts`): tests run in the Workers runtime with the bindings from `wrangler.jsonc`, and every migration in `migrations/` is applied to the test D1 before each test file (`test/apply-migrations.ts`).
10. Tests of the start page, the error page and the shared middleware, so CI's `check` job runs typecheck and tests for real.

## Conventions for later units

- Screens: one file per screen under `src/routes/`, exporting a `new Hono<AppEnv>()` sub-app, registered in `src/index.ts` with one `app.route('/', ...)` line. Full pages call `c.render(<Content />, { title })`; htmx fragments (the 10-second polls, partial updates) return `c.html(<Fragment />)`, which skips the layout.
- Challenges and decoys are identified by their number, 1 to 20, everywhere: content, database columns and game functions. Content holds them in that order, so challenge `n` is `challenges[n - 1]`.
- Game logic: pure functions in `src/game/`, one file per topic (scoring, assignment, phases).
- Content: `src/content/` (unit 1.02).
- Database: tables in `src/db/schema.ts`, then `npm run db:generate` writes the migration into `migrations/`. Tests get it applied automatically.
- Tests: in `test/`, one file per topic, named `*.test.ts` or `*.test.tsx`. A test calls the Worker with `exports.default.fetch(url, init)` from `cloudflare:workers` and reads bindings with `env` from `cloudflare:test`.
- Form posts: actions are plain HTML forms or htmx requests (both send form-encoded bodies). The `csrf()` middleware refuses such a post unless its `Origin` is this site or the browser marks it `Sec-Fetch-Site: same-origin`, so tests that post forms set `Origin: https://example.com` when they fetch `https://example.com/...`. It ignores other content types, which other sites can't send anyway, since the app sends no CORS headers; don't add CORS.
- Bindings: change `wrangler.jsonc`, then `npm run cf-typegen`. Never edit `worker-configuration.d.ts` by hand. The secrets are already declared; a unit that needs a new one adds it to `secrets.required`, `.dev.vars.example` and the test bindings in `vitest.config.ts`.
- Node.js APIs: the compatibility date turns Node.js compatibility on, so `node:` imports work. `wrangler types` suggests `@types/node`; it isn't needed until a unit imports a `node:` module.

## Tests

- `test/home.test.ts`: `/` returns 200 with the layout (the viewport tag, Pico CSS and htmx), and an unknown path returns the 404 page with a link back to `/`.
- `test/security.test.ts`: form posts from this site get through the CSRF check (with this site as `Origin`, and with `Origin: null` plus `Sec-Fetch-Site: same-origin`, as browsers send), cross-site posts get 403, and the secure headers are sent with `Referrer-Policy: same-origin`.
- Game rules have no tests in this unit; it has no game logic.

## Done when

- `npm run typecheck` and `npm test` pass, locally and in CI's `check` job.
- `npm run db:migrate:local` and `npm run dev` work, and the start page loads in a phone-sized browser with Pico CSS and htmx served from `/vendor/`.
- `npm run db:generate` runs against the empty schema.

## Not in this unit

- The schema, migrations, content sets and phase rules (1.02).
- The production D1 database, the secrets' production values, Danny's checklist and the Workers Builds settings, including the Node version and applying migrations on deploy (1.03).
- Any game logic (2.01, 2.02) or real screens (phase 3).

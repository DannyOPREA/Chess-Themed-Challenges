# Log: phase 1, unit 01: Scaffold

Plan: [docs/phase-1-foundation/01-scaffold.md](../../docs/phase-1-foundation/01-scaffold.md)

## 2026-10-07: Plan written

**Done**
- Wrote the unit plan from `docs/phases.md`, unit 1.01.

**Worked**
- Nothing to note yet.

**Didn't work**
- Nothing.

**Decisions**
- Plan and build in the same PR. Why: `docs/README.md` and the working agreement.

## 2026-10-07: Scaffold built

**Done**
- Installed the agreed stack and wrote the scaffold as the plan describes: npm scripts, `wrangler.jsonc`, the shared layout, a placeholder start page, Drizzle and drizzle-kit, Vitest in the Workers runtime with D1 migrations applied before tests, and one test.
- Checked by hand: `npm run typecheck`, `npm test`, `npm run db:generate` ("No schema changes"), `npm run db:migrate:local` ("No migrations to apply"), and `npm run dev` serving `/` (200), `/vendor/pico.min.css` and `/vendor/htmx.min.js` (200), an unknown path (404), and a cross-site form post (403).

**Worked**
- Tests pass without `public/vendor/` existing, so CI needs no build step before `npm test`.
- `wrangler types` writes the `Env` type and the Workers runtime types into one file, so no `@cloudflare/workers-types` package is needed.

**Didn't work**
- `npm install` of `vitest` failed with the container's npm 10.9 ("Cannot read properties of null (reading 'edgesOut')", an npm bug with Vitest's optional peer dependencies). Installed with `npx npm@11` instead. `npm ci` with npm 10.9, as CI and the session hook run it, installs from the resulting lockfile without trouble (checked).
- `@cloudflare/vitest-pool-workers` installs with a deprecation notice: it has been renamed `@cloudflare/vitest-plugin`. Switched to the new name.
- `readD1Migrations` fails when `migrations/` doesn't exist, and drizzle-kit writes nothing for an empty schema, so `migrations/` holds a `.gitkeep` until unit 1.02 adds the first migration.
- `exports.default` from `cloudflare:workers` had no type because `wrangler types` doesn't declare the main module. Declared it in `test/env.d.ts` (`Cloudflare.GlobalProps.mainModule`).

**Decisions**
- `@cloudflare/vitest-plugin` instead of `@cloudflare/vitest-pool-workers`. Why: it is the same Cloudflare package under its new name; the old name gets no more updates. Not a stack swap.
- Vitest 4.1, not the latest 5.0. Why: the Workers plugin supports Vitest 4.1 only.
- TypeScript 7 (the latest). Why: typecheck passes with it and nothing in the stack needs an older version.
- Every package in the agreed stack is installed now, including the ones later units use (`zod`, `@hono/zod-validator`, `uqr`). Why: four units start in parallel after this one, and each adding its own package would make them conflict on `package-lock.json`.
- Pico CSS and htmx are served by the app itself, copied from `node_modules` into `public/vendor/` by wrangler's build step and served as Workers static assets, rather than loaded from a CDN. Why: the versions stay pinned by the lockfile, the pages depend on one site being up on the night instead of two, and static assets are free and don't count as Worker requests. The copied files are git-ignored so they can't drift from `package.json`.
- `CONTENT_SET` is typed as `string`, not the literal `"test"` (`wrangler types --strict-vars=false`). Why: it can be `real` in production, so the content loader (unit 1.02) has to check the value rather than trust the type.
- `worker-configuration.d.ts` is committed and marked as generated in `.gitattributes`. Why: CI's typecheck needs it, and Cloudflare recommends committing it; marking it generated keeps its 16,000 lines out of PR diffs.
- The D1 binding has no `database_id` yet. Why: local dev and tests don't need one, and creating the production database is one of Danny's steps in unit 1.03, which adds the ID (or relies on wrangler creating the database on first deploy).
- `secureHeaders()` and `csrf()` on every route. Why: both are Hono middleware (rule 1). `csrf()` matters for the host page: the browser resends its basic auth password on its own, so without it another site could post a phase change. Later units' tests set an `Origin` header on form posts (the plan's conventions).
- Tests live in `test/` and call the Worker through `exports.default.fetch`. Why: Cloudflare's current recommendation (`SELF` is deprecated), and it exercises the real Worker with its middleware.
- `createDb()` added now, with the empty schema. Why: units 1.02, 3.01 and 3.04 all need it, and adding it once here avoids conflicting copies.

## 2026-10-07: Code review

**Done**
- Ran `/code-review` at `high` on the branch's diff against `main`. Eight findings, handled as follows:
  1. `drizzle.config.ts` said Workers Builds applies migrations in production; the default deploy command doesn't. Fixed the comment: unit 1.03 sets up how production applies them.
  2. The plan's CSRF convention overstated what `csrf()` checks (form content types only, and it also accepts `Sec-Fetch-Site: same-origin`). Fixed the wording in the plan and `src/index.ts`; other sites can't send other content types at all because the app sends no CORS headers. Added `test/security.test.ts` (cross-site form post refused, same-site post let through, secure headers sent).
  3. The test-only migrations binding was added to the global `Env`, so app code could have typechecked against it. Moved it to Vitest's `provide`/`inject` instead.
  4. `CLAUDE.md` and `docs/phases.md` still named `@cloudflare/vitest-pool-workers`. Updated both to the new name (logged in `general.md` for `phases.md`).
  5. `npm run cf-typegen` wasn't in the permission allow list. Added it to `.claude/settings.json`.
  6. `tsconfig.json` included `scripts/`, which holds only a `.mjs` file it never checks. Removed it.
  7. `scripts/copy-vendor.mjs` is custom code (rule 1). Kept, see Decisions.
  8. No test checks that `/vendor/*` is actually served. Not fixed in a test, see Decisions.

**Worked**
- Typecheck and the five tests pass after the fixes.

**Didn't work**
- The branch was first cut from a stale local `origin/main` (PR #3), so the first push lacked everything merged since (PRs #4 to #6). Found while fixing finding 4, rebased onto the current `main` before any review was complete, and restarted the `unit-reviewer`.

**Decisions**
- Keep the vendor copy script. Why: it is eight lines of build glue, not a solved problem a library covers; the alternatives are a CDN (a second site the pages depend on during the night) or Wrangler text-module rules for `.js` files (fragile with the bundler and the test runner). `copyFileSync` throws on a missing file, so a moved file fails the build loudly instead of shipping pages without CSS.
- No automated test that `/vendor/*` is served. Why: tests call the Worker directly and Workers static assets sit in front of it, so a test can't see them; the unit-reviewer checks the files load in the browser, and unit 1.03 owns the Workers Builds build and deploy commands.

## 2026-10-07: Unit review

**Done**
- Ran the `unit-reviewer` agent on the rebased branch. Verdict "Fix needed", nothing Blocking, three Should fix items and some notes:
  1. Should fix: with `secureHeaders()`' default `Referrer-Policy: no-referrer`, Chromium sent `Origin: null` on a plain same-site form post, which passed `csrf()` only through `Sec-Fetch-Site`. Phones without `Sec-Fetch-Site` (Safari before 16.4) would have been refused every plain form post. Fixed: referrer policy `same-origin`. Added tests for the browser-shaped headers (`Origin: null` with `same-origin` passes, with `cross-site` gets 403).
  2. Should fix: the committed `worker-configuration.d.ts` was stale, so `wrangler dev` warned "types might be out of date". It had been generated before `src/index.ts` existed. Regenerated; the generated file now declares the main module, so the hand-written declaration in `test/env.d.ts` is gone. This corrects the earlier entry's line that `wrangler types` doesn't declare the main module: it does, once `src/index.ts` exists.
  3. Should fix: units 3.01, 3.04 and 1.03 would each have added a secret to `wrangler.jsonc`, `vitest.config.ts` and the generated types. Fixed: both secrets (`HOST_PASSWORD`, `COOKIE_SECRET`) are declared now in `secrets.required`, with test values in `vitest.config.ts` and local values in `.dev.vars.example`. `docs/phases.md` (1.03) updated to match, logged in `general.md`.
  4. Should fix (minor): the plan's Tests section didn't list `test/security.test.ts`. Fixed.
  - Notes acted on: a convention that challenges and decoys are numbered 1 to 20 everywhere, a convention that htmx fragments use `c.html()`, shared 404 and 500 pages with a link back to the start (in place of bare text), and a plan line on Node.js compatibility.
  - Notes left: drizzle-kit leaves an untracked `migrations/meta/_journal.json` when run on the empty schema (harmless, and unit 1.02 commits `meta/` with its first migration); the Node version for Workers Builds is unit 1.03's; parallel appends to `logs/general.md` can conflict, trivially.
- The reviewer confirmed in a phone-sized Chromium that the start page loads Pico CSS and htmx from `/vendor/`, with no overflow and no console errors, in light and dark mode, and that the code-review decisions above hold.

**Worked**
- Typecheck and 7 tests pass; `wrangler dev` no longer warns about stale types.

**Didn't work**
- Nothing.

**Decisions**
- Referrer policy `same-origin`. Why: it keeps the real `Origin` on form posts for the CSRF check while still sending no referrer to other sites.
- Secrets declared by name in 1.01 instead of 1.03. Why: three units need them and would otherwise conflict on the same lines; declaring a name doesn't need a value until deploy, and `secrets.required` only drives type generation and a local warning.
- Challenges and decoys are numbered 1 to 20. Why: units 1.02 (content) and 2.02 (assignment) are built in parallel and must agree; the numbers match the test set's names ("Challenge 1").
- Error pages are in this unit. Why: no other unit owns them, and a player with a stale link should get a way back rather than bare text.

## 2026-10-07: Second unit review and merge

**Done**
- Ran the unit reviewer again on the fixes. Verdict "Pass": all four first-round findings confirmed fixed in a fresh clone and in a phone-sized Chromium (a plain form post now carries the real `Origin`, `cf-typegen` leaves the generated types unchanged, the secrets reach dev and tests, the plan's Tests section matches).
- Acted on its notes: added `test/errors.test.tsx` (the 500 page hides error details; `basicAuth`'s 401 passes through `onError`, which unit 3.04 relies on), made the error pages' link a Pico button so it is easier to tap, noted in `vitest.config.ts` that the "Missing required secrets" warning in test output is expected, said in the plan that `/vendor/` files don't get the secure headers, and updated the PR description.
- Left as is: the untracked `migrations/meta/_journal.json` after `db:generate` on the empty schema (unit 1.02 commits `meta/` with its first migration).
- `main` merged into the branch is not needed: the branch is already on top of the current `main`.

**Worked**
- Typecheck and 9 tests pass.

**Didn't work**
- Nothing.

**Decisions**
- No secure headers on the `/vendor/` files. Why: they are same-site CSS and JavaScript served by static assets before the Worker runs; adding headers there would need a `_headers` file for no real gain.

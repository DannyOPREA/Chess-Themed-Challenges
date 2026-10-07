// The Hono environment every route shares. `Env` (the Worker's bindings and
// vars) is generated from wrangler.jsonc by `npm run cf-typegen` into
// worker-configuration.d.ts; never write it by hand.
export type AppEnv = {
  Bindings: Env
}

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

// Tests run inside the Workers runtime with the bindings from wrangler.jsonc
// and a local D1. Every migration in migrations/ is applied before the tests
// (test/apply-migrations.ts).
export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations')
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
      }),
    ],
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
    },
  }
})

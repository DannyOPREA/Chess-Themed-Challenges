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
        // Wrangler still warns "Missing required secrets" when tests start;
        // these values do reach the tests, so the warning is expected.
        miniflare: {
          bindings: { HOST_PASSWORD: 'test-host-password', COOKIE_SECRET: 'test-cookie-secret' },
        },
      }),
    ],
    test: {
      provide: { migrations },
      setupFiles: ['./test/apply-migrations.ts'],
    },
  }
})

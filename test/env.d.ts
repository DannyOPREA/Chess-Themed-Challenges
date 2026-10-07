import type { D1Migration } from 'cloudflare:test'

declare global {
  namespace Cloudflare {
    // The test-only binding set in vitest.config.ts.
    interface Env {
      TEST_MIGRATIONS: D1Migration[]
    }
    // Types `exports` from 'cloudflare:workers' as the Worker's own exports.
    interface GlobalProps {
      mainModule: typeof import('../src/index')
    }
  }
}

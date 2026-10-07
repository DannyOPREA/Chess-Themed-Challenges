import type { D1Migration } from 'cloudflare:test'

declare global {
  namespace Cloudflare {
    // Types `exports` from 'cloudflare:workers' as the Worker's own exports.
    interface GlobalProps {
      mainModule: typeof import('../src/index')
    }
  }
}

// Handed from vitest.config.ts to test/apply-migrations.ts. Kept out of the
// Worker's bindings so app code can't come to depend on it.
declare module 'vitest' {
  interface ProvidedContext {
    migrations: D1Migration[]
  }
}

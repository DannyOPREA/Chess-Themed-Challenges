import { applyD1Migrations, env } from 'cloudflare:test'
import { inject } from 'vitest'

// Runs before each test file. Already-applied migrations are skipped.
await applyD1Migrations(env.DB, inject('migrations'))

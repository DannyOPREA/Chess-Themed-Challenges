import { env } from 'cloudflare:test'
import { createDb } from '../src/db/client'
import { gameMarker, resetGame } from '../src/db/host'

// Each test file gets its own database, migrated and seeded, but tests in the
// same file share it. Call this in `beforeEach` to start every test from an
// empty game in the Lobby. It is the host's own reset (unit 3.06), so a unit
// that adds a table adds it to `resetGame` and both stay in step.
export const resetDb = async () => {
  const db = createDb(env.DB)
  await resetGame(db, await gameMarker(db))
}

import { env } from 'cloudflare:test'
import { createDb } from '../src/db/client'
import { accusations, game, players } from '../src/db/schema'

// Each test file gets its own database, migrated and seeded, but tests in the
// same file share it. Call this in `beforeEach` to start every test from an
// empty game in the Lobby. A unit that adds a table adds it here.
export const resetDb = async () => {
  const db = createDb(env.DB)
  await db.batch([
    db.delete(accusations),
    db.delete(players),
    db.update(game).set({ phase: 'lobby' }),
  ])
}

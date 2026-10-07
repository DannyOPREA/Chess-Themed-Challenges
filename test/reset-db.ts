import { env } from 'cloudflare:test'

// Each test file gets its own database, migrated and seeded, but tests in the
// same file share it. Call this in `beforeEach` to start every test from an
// empty game in the Lobby.
export const resetDb = async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM accusations'),
    env.DB.prepare('DELETE FROM players'),
    env.DB.prepare("UPDATE game SET phase = 'lobby' WHERE id = 1"),
  ])
}

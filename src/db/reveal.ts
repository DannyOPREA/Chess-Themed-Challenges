import { eq } from 'drizzle-orm'
import type { ScoringAccusation, ScoringPlayer } from '../game/scoring'
import type { Db } from './client'
import { accusations, game, players } from './schema'

// Everything the reveal (unit 3.05) scores: the phase, every player and every
// final guess, read in one D1 batch so they come from the same moment. Callers
// must check the phase before sending any of it to a phone.
export const loadReveal = async (db: Db) => {
  const [phaseRows, playerRows, accusationRows] = await db.batch([
    db.select({ phase: game.phase }).from(game).where(eq(game.id, 1)),
    db
      .select({
        id: players.id,
        name: players.name,
        challenge: players.challenge,
        decoy: players.decoy,
        completed: players.completed,
      })
      .from(players),
    db
      .select({
        accuserId: accusations.accuserId,
        accusedId: accusations.accusedId,
        challenge: accusations.challenge,
      })
      .from(accusations),
  ])
  const phase = phaseRows[0]?.phase
  if (!phase) throw new Error('The game row is missing; apply the migrations')
  return {
    phase,
    players: playerRows satisfies ScoringPlayer[],
    accusations: accusationRows satisfies ScoringAccusation[],
  }
}

import type { ScoringAccusation, ScoringPlayer } from '../game/scoring'
import type { Db } from './client'
import { accusations, players } from './schema'

// Everything the reveal (unit 3.05, and the host's copy, unit 3.07) scores: every player and every final
// guess, read in one D1 batch so they come from the same moment. Only for the
// Reveal phase: check the phase first, as this reads everyone's challenge.
export type FinalGame = { players: ScoringPlayer[]; accusations: ScoringAccusation[] }

export const loadFinalGame = async (db: Db): Promise<FinalGame> => {
  const [playerRows, accusationRows] = await db.batch([
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
  return { players: playerRows, accusations: accusationRows }
}

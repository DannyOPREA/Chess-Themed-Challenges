import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import { PHASES, phaseAllows } from '../game/phases'
import type { Db } from './client'
import { game, players } from './schema'

// The player screen's writes (unit 3.02).

// The game's phase at the moment a statement runs, so a write can be guarded
// on it rather than on a phase read a moment earlier.
const currentPhase = sql`(select ${game.phase} from ${game} where ${game.id} = 1)`

// The phases in which players can mark their own completion (unit 1.02's rules).
const OWN_COMPLETION_PHASES = PHASES.filter((p) => phaseAllows(p, 'markOwnCompletion'))

/**
 * A player marks their own challenge done, or undoes it (the honour system;
 * the host can override it). Only in Game on, checked as the write runs, so a
 * tap from a screen loaded before accusations closed changes nothing. Returns
 * false, changing nothing, if the phase doesn't allow it, the player has no
 * challenge, or the player was removed.
 */
export const setOwnCompletion = async (db: Db, id: number, completed: boolean): Promise<boolean> => {
  const rows = await db
    .update(players)
    .set({ completed })
    .where(and(eq(players.id, id), isNotNull(players.challenge), inArray(currentPhase, OWN_COMPLETION_PHASES)))
    .returning({ id: players.id })
  return rows.length === 1
}

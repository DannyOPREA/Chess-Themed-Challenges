import { and, eq, isNotNull } from 'drizzle-orm'
import type { Db } from './client'
import { currentPhaseAllows } from './game'
import { players } from './schema'

// The player screen's writes (unit 3.02).

/**
 * A player marks their own challenge done, or undoes it (the honour system;
 * the host can override it). Only in Game on, checked as the write runs, so a
 * tap from a screen loaded before accusations closed changes nothing. Returns
 * false, changing nothing, if the phase doesn't allow it, the player has no
 * challenge, or the player was removed. The host's version is `setCompletion`
 * (src/db/host.ts), allowed in more phases.
 */
export const setOwnCompletion = async (db: Db, id: number, completed: boolean): Promise<boolean> => {
  const rows = await db
    .update(players)
    .set({ completed })
    .where(and(eq(players.id, id), isNotNull(players.challenge), currentPhaseAllows('markOwnCompletion')))
    .returning({ id: players.id })
  return rows.length === 1
}

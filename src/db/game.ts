import { eq } from 'drizzle-orm'
import type { Phase } from '../game/phases'
import type { Db } from './client'
import { game } from './schema'

// The game's current phase. The seed migration adds the single game row, so
// it is always there.
export const getPhase = async (db: Db): Promise<Phase> => {
  const row = await db.select({ phase: game.phase }).from(game).where(eq(game.id, 1)).get()
  if (!row) throw new Error('The game row is missing; apply the migrations')
  return row.phase
}

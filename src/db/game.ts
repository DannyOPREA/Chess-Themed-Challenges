import { eq, inArray, sql } from 'drizzle-orm'
import { type Phase, type PhaseAction, PHASES, phaseAllows } from '../game/phases'
import type { Db } from './client'
import { game } from './schema'

// The game's current phase. The seed migration adds the single game row, so
// it is always there.
export const getPhase = async (db: Db): Promise<Phase> => {
  const row = await db.select({ phase: game.phase }).from(game).where(eq(game.id, 1)).get()
  if (!row) throw new Error('The game row is missing; apply the migrations')
  return row.phase
}

// The game's phase at the moment a statement runs, for use inside another
// statement, so a write can be guarded on it rather than on a phase read a
// moment earlier.
export const currentPhase = sql<Phase>`(select ${game.phase} from ${game} where ${game.id} = 1)`

// A condition, for inside another statement: the phase at that moment allows
// `action` (unit 1.02's rules).
export const currentPhaseAllows = (action: PhaseAction) =>
  inArray(
    currentPhase,
    PHASES.filter((p) => phaseAllows(p, action)),
  )

import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { hashPin } from '../auth/pin'
import { assignPlayers, type RandomSource } from '../game/assignment'
import { canChangePhase, PHASES, type Phase, phaseAllows } from '../game/phases'
import type { Db } from './client'
import { currentPhase } from './game'
import { game, players } from './schema'

// The host page's reads and writes (unit 3.04). Only the host page calls these.

// Whether a player has been given their challenge and decoy, without either.
const assigned = sql<boolean>`${players.challenge} is not null`.mapWith(Boolean)

/** Who has joined, in joining order, without anything that could spoil the game. */
export const listPlayers = (db: Db) =>
  db
    .select({ id: players.id, name: players.name, assigned })
    .from(players)
    .orderBy(asc(players.joinedAt), asc(players.id))
    .all()

/** One player for the host's player page. Includes completion, not challenge or decoy. */
export const getPlayer = (db: Db, id: number) =>
  db
    .select({
      id: players.id,
      name: players.name,
      assigned,
      completed: players.completed,
    })
    .from(players)
    .where(eq(players.id, id))
    .get()

/** Everything, for the emergency "show all" button only. */
export const listPlayersWithSecrets = (db: Db) =>
  db
    .select({
      id: players.id,
      name: players.name,
      challenge: players.challenge,
      decoy: players.decoy,
      completed: players.completed,
    })
    .from(players)
    .orderBy(asc(players.joinedAt), asc(players.id))
    .all()

/**
 * Moves the game from `from` to `to`. Returns false, changing nothing, if that
 * isn't an allowed change or the game is no longer in `from` (a double tap, or
 * a second host tab).
 *
 * Starting Game on also assigns everyone in the lobby, in the same D1 batch
 * (one transaction) as the phase change, so a phone that sees Game on also
 * sees every lobby player's numbers. The assignments run first, each guarded
 * on the game still being in `from` and the player still having no numbers,
 * then the guarded phase move: a run that loses a race (a double tap, a stale
 * tab) writes nothing at all, so two runs can't mix their picks. Anyone who
 * joins between the read and the batch is left without numbers in Game on;
 * the join screen (unit 3.01) assigns such players.
 */
export const changePhase = async (
  db: Db,
  from: Phase,
  to: Phase,
  options: { random?: RandomSource } = {},
): Promise<boolean> => {
  if (!canChangePhase(from, to)) return false
  const move = db
    .update(game)
    .set({ phase: to })
    .where(and(eq(game.id, 1), eq(game.phase, from)))
    .returning({ phase: game.phase })
  if (to !== 'game_on') return (await move).length === 1

  const current = await db
    .select({ id: players.id, challenge: players.challenge, decoy: players.decoy })
    .from(players)
    .all()
  const assignments = assignPlayers(current, options).map((p) =>
    db
      .update(players)
      .set({ challenge: p.challenge, decoy: p.decoy })
      .where(
        and(
          eq(players.id, p.id),
          isNull(players.challenge),
          isNull(players.decoy),
          eq(currentPhase, from),
        ),
      ),
  )
  const [first, ...rest] = assignments
  if (!first) return (await move).length === 1
  const results = await db.batch([first, ...rest, move])
  return (results.at(-1) as { phase: Phase }[]).length === 1
}

// The phases in which the host can fix a completion (unit 1.02's rules).
const COMPLETION_PHASES = PHASES.filter((p) => phaseAllows(p, 'hostMarkCompletion'))

/**
 * Marks or unmarks a player's completion. Returns false, changing nothing, if
 * the player is gone, has no challenge yet, or the phase doesn't allow it at
 * the moment of the write (a page loaded before the Reveal can't change a
 * completion after it).
 */
export const setCompletion = async (db: Db, id: number, completed: boolean) => {
  const rows = await db
    .update(players)
    .set({ completed })
    .where(and(eq(players.id, id), isNotNull(players.challenge), inArray(currentPhase, COMPLETION_PHASES)))
    .returning({ id: players.id })
  return rows.length === 1
}

/** Gives a player a new PIN. Returns false if the player is gone. */
export const resetPin = async (db: Db, id: number, pin: string) => {
  const rows = await db
    .update(players)
    .set(await hashPin(pin))
    .where(eq(players.id, id))
    .returning({ id: players.id })
  return rows.length === 1
}

/**
 * Removes a player. The database removes the accusations they made and the
 * ones about them, and their challenge and decoy become free again.
 */
export const removePlayer = async (db: Db, id: number) => {
  const rows = await db.delete(players).where(eq(players.id, id)).returning({ id: players.id })
  return rows.length === 1
}

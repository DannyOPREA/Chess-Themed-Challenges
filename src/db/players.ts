import { and, eq, isNull, sql } from 'drizzle-orm'
import { assignOne, type AssignOptions } from '../game/assignment'
import { nameKey } from '../game/names'
import { type Phase, PHASES, phaseAllows } from '../game/phases'
import type { Db } from './client'
import { currentPhase, getPhase } from './game'
import { game, type Player, players } from './schema'

// Reading and writing players for joining and rejoining (unit 3.01).

const phaseList = (phases: readonly Phase[]) =>
  sql.join(
    phases.map((p) => sql`${p}`),
    sql`, `,
  )

export const findPlayerByName = (db: Db, name: string): Promise<Player | undefined> =>
  db.select().from(players).where(eq(players.nameKey, nameKey(name))).get()

const findPlayerById = (db: Db, id: number): Promise<Player | undefined> =>
  db.select().from(players).where(eq(players.id, id)).get()

// Adds a new player, not yet assigned, if the game allows joining at that
// moment. Returns nothing if joining has closed, or if the name is taken
// (ignoring capitals), including by someone who joined a moment ago.
export const createPlayer = async (
  db: Db,
  name: string,
  pin: { pinHash: string; pinSalt: string },
): Promise<Player | undefined> => {
  const joinPhases = phaseList(PHASES.filter((p) => phaseAllows(p, 'join')))
  // SQLite needs the WHERE for an INSERT ... SELECT to take an ON CONFLICT.
  const inserted = await db.all<{ id: number }>(sql`
    insert into ${players} (name, name_key, pin_hash, pin_salt)
    select ${name}, ${nameKey(name)}, ${pin.pinHash}, ${pin.pinSalt}
    where ${currentPhase} in (${joinPhases})
    on conflict (name_key) do nothing
    returning id`)
  const id = inserted[0]?.id
  return id === undefined ? undefined : findPlayerById(db, id)
}

// How many times a late joiner's pick is retried before it is written without
// checking for a clash. Each failed try means another player's assignment was
// written first, so with about 20 players this is never reached in practice.
export const MAX_ASSIGN_ATTEMPTS = 20

// Gives a player with no challenge yet their challenge and decoy, if the game
// is in Game on: a late joiner, or someone who joined just as the host started
// Game on and was missed by the host's assignment (unit 3.04). Anyone else is
// returned as they are. Returns nothing if the player was removed meanwhile.
export const ensureAssigned = async (
  db: Db,
  player: Player,
  options: AssignOptions = {},
): Promise<Player | undefined> => {
  if (player.challenge !== null || (await getPhase(db)) !== 'game_on') return player
  return assignLateJoiner(db, player.id, options)
}

// Picks with `assignOne` (unit 2.02) from everyone else's numbers, then writes
// the pick only if, at that moment, the game is still in Game on, the player
// is still unassigned, and nobody else has taken either number since the read
// (the count of other holders is unchanged). D1 runs each statement whole,
// one at a time, so no other phone can get between that check and the write.
// If it doesn't apply, read and pick again: someone else was assigned first,
// or the phase moved on, which the next read sees.
export const assignLateJoiner = async (
  db: Db,
  playerId: number,
  options: AssignOptions = {},
): Promise<Player | undefined> => {
  for (let attempt = 1; ; attempt++) {
    const [everyone, phaseRows] = await db.batch([
      db.select({ id: players.id, challenge: players.challenge, decoy: players.decoy }).from(players),
      db.select({ phase: game.phase }).from(game).where(eq(game.id, 1)),
    ])
    const player = everyone.find((p) => p.id === playerId)
    if (!player) return undefined
    if (player.challenge !== null || phaseRows[0]?.phase !== 'game_on') {
      return findPlayerById(db, playerId)
    }
    const others = everyone.filter((p) => p.id !== playerId)
    const pick = assignOne(others, options)
    const checkClash = attempt <= MAX_ASSIGN_ATTEMPTS
    if (!checkClash) {
      console.warn(`Assigning player ${playerId} without the clash check after ${MAX_ASSIGN_ATTEMPTS} tries`)
    }
    const heldBy = (column: 'challenge' | 'decoy') =>
      others.filter((p) => p[column] === pick[column]).length
    const [assigned] = await db
      .update(players)
      .set(pick)
      .where(
        and(
          eq(players.id, playerId),
          isNull(players.challenge),
          sql`${currentPhase} = 'game_on'`,
          checkClash
            ? sql`(select count(*) from players p where p.challenge = ${pick.challenge} and p.id <> ${playerId}) = ${heldBy('challenge')}`
            : undefined,
          checkClash
            ? sql`(select count(*) from players p where p.decoy = ${pick.decoy} and p.id <> ${playerId}) = ${heldBy('decoy')}`
            : undefined,
        ),
      )
      .returning()
    if (assigned) return assigned
  }
}

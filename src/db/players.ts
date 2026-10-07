import { and, eq, isNull, sql } from 'drizzle-orm'
import type { StoredPin } from '../auth/pin'
import { assignOne, type AssignOptions } from '../game/assignment'
import { nameKey } from '../game/names'
import type { Db } from './client'
import { getPhase } from './game'
import { type Player, players } from './schema'

// Reading and writing players for joining and rejoining (unit 3.01).

export const findPlayerByName = (db: Db, name: string): Promise<Player | undefined> =>
  db.select().from(players).where(eq(players.nameKey, nameKey(name))).get()

// Adds a new player, not yet assigned. Returns nothing if the name is taken
// (ignoring capitals), including by someone who joined a moment ago.
export const createPlayer = async (
  db: Db,
  name: string,
  pin: StoredPin,
): Promise<Player | undefined> => {
  const [player] = await db
    .insert(players)
    .values({ name, nameKey: nameKey(name), ...pin })
    .onConflictDoNothing({ target: players.nameKey })
    .returning()
  return player
}

// How many times a late joiner's pick is retried before it is written without
// checking for a clash. Each failed try means another player's assignment was
// written first, so with about 20 players this is never reached in practice.
export const MAX_ASSIGN_ATTEMPTS = 20

// Gives a player with no challenge yet their challenge and decoy, if the game
// is in Game on: a late joiner, or someone who joined just as the host started
// Game on and was missed by the host's assignment (unit 3.04). Lobby players
// wait for Game on; a player who already has numbers is returned unchanged.
export const ensureAssigned = async (
  db: Db,
  player: Player,
  options: AssignOptions = {},
): Promise<Player | undefined> => {
  if (player.challenge !== null) return player
  if ((await getPhase(db)) !== 'game_on') return player
  return assignLateJoiner(db, player.id, options)
}

// Picks with `assignOne` (unit 2.02) from everyone else's numbers, then writes
// the pick only if the player is still unassigned and nobody else has taken
// either number since the read. D1 runs each statement on its own, one at a
// time, so the check and the write can't be split by another phone. If the
// check fails, someone else was assigned first: read again and pick again.
// Returns the player as stored, or nothing if they were removed meanwhile.
export const assignLateJoiner = async (
  db: Db,
  playerId: number,
  options: AssignOptions = {},
): Promise<Player | undefined> => {
  for (let attempt = 1; ; attempt++) {
    const everyone = await db.select().from(players)
    const player = everyone.find((p) => p.id === playerId)
    if (!player || player.challenge !== null) return player
    const others = everyone.filter((p) => p.id !== playerId)
    const pick = assignOne(others, options)
    const guarded = attempt <= MAX_ASSIGN_ATTEMPTS
    if (!guarded) {
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
          guarded
            ? sql`(select count(*) from players p where p.challenge = ${pick.challenge} and p.id <> ${playerId}) = ${heldBy('challenge')}`
            : undefined,
          guarded
            ? sql`(select count(*) from players p where p.decoy = ${pick.decoy} and p.id <> ${playerId}) = ${heldBy('decoy')}`
            : undefined,
        ),
      )
      .returning()
    if (assigned) return assigned
  }
}

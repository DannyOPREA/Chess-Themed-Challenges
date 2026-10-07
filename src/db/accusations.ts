import { and, eq, ne, sql } from 'drizzle-orm'
import type { Db } from './client'
import { getPhase } from './game'
import { accusations, game, players } from './schema'

// Making, changing and clearing accusations (unit 3.03). The table keeps one
// row per accuser and accused (unit 1.02): a player's current guess about that
// player. Changing a guess updates the row and clearing it deletes the row, so
// at the reveal the table holds exactly everyone's final guesses.

// The game's phase at the moment a statement runs, so a write is refused if
// accusations closed after the page was loaded.
const currentPhase = sql`(select ${game.phase} from ${game} where ${game.id} = 1)`

/** Every other player, with this player's own current guess about them (or null). */
export type Target = { id: number; name: string; guess: number | null }

// By name ignoring capitals (names are unique that way), then by id, as the
// reveal orders names (unit 2.01).
const byName = (a: Target, b: Target) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'accent' }) || a.id - b.id

/**
 * The players `playerId` can accuse (everyone else), each with `playerId`'s
 * own guess about them. Nothing about anyone else's challenge, completion or
 * accusations, so it is safe to send to the player (CLAUDE.md rule 2).
 */
export const listTargets = async (db: Db, playerId: number): Promise<Target[]> => {
  const rows = await db
    .select({ id: players.id, name: players.name, guess: accusations.challenge })
    .from(players)
    .leftJoin(
      accusations,
      and(eq(accusations.accusedId, players.id), eq(accusations.accuserId, playerId)),
    )
    .where(ne(players.id, playerId))
    .all()
  return rows.sort(byName)
}

export type GuessResult =
  // The guess is saved (or cleared).
  | 'saved'
  // Accusations aren't open: before Game on, or after they closed.
  | 'closed'
  // The accused player (or the accuser) has been removed.
  | 'gone'
  // Accusing yourself.
  | 'self'

/**
 * Sets `accuserId`'s guess about `accusedId` to `challenge`, or clears it when
 * `challenge` is null. Each write checks, at the moment it runs, that the game
 * is in Game on and both players are still in it, so a page loaded before
 * accusations closed can't change a guess after they did.
 */
export const setGuess = async (
  db: Db,
  accuserId: number,
  accusedId: number,
  challenge: number | null,
): Promise<GuessResult> => {
  if (accuserId === accusedId) return 'self'
  const written =
    challenge === null
      ? await db
          .delete(accusations)
          .where(
            and(
              eq(accusations.accuserId, accuserId),
              eq(accusations.accusedId, accusedId),
              sql`${currentPhase} = 'game_on'`,
            ),
          )
          .returning({ id: accusations.accusedId })
      : // SQLite needs the WHERE for an INSERT ... SELECT to take an ON CONFLICT.
        await db.all<{ id: number }>(sql`
          insert into ${accusations} (accuser_id, accused_id, challenge)
          select ${accuserId}, p.id, ${challenge} from ${players} p
          where p.id = ${accusedId}
            and exists (select 1 from ${players} a where a.id = ${accuserId})
            and ${currentPhase} = 'game_on'
          on conflict (accuser_id, accused_id) do update set challenge = excluded.challenge
          returning accused_id as id`)
  if (written.length > 0) return 'saved'
  // Nothing written: work out why. Clearing a guess that wasn't there is fine.
  if ((await getPhase(db)) !== 'game_on') return 'closed'
  const found = await db
    .select({ id: players.id })
    .from(players)
    .where(sql`${players.id} in (${accuserId}, ${accusedId})`)
    .all()
  return found.length === 2 ? 'saved' : 'gone'
}

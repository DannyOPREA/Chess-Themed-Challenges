import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { CONTENT_SIZE } from '../content/size'
import { PHASES } from '../game/phases'

// The Drizzle schema. `npm run db:generate` turns changes here into a SQL
// migration in migrations/. Challenges and decoys are stored by number, 1 to
// CONTENT_SIZE; their text comes from the content set (src/content/).

const phaseList = sql.raw(PHASES.map((p) => `'${p}'`).join(', '))
// Whole numbers only (SQLite would otherwise store 1.5 as it is), or null,
// which `notNull()` refuses where a column needs a value.
const inContentRange = (column: string) =>
  sql.raw(
    `${column} is null or (typeof(${column}) = 'integer' and ${column} between 1 and ${CONTENT_SIZE})`,
  )

// The one game: a single row, id 1, added by the seed migration in the Lobby
// phase. Read it with `getPhase` (src/db/game.ts).
export const game = sqliteTable(
  'game',
  {
    id: integer('id').primaryKey(),
    phase: text('phase', { enum: PHASES }).notNull().default('lobby'),
  },
  () => [check('game_single_row', sql`id = 1`), check('game_phase_valid', sql`phase in (${phaseList})`)],
)

export const players = sqliteTable(
  'players',
  {
    // AUTOINCREMENT, so a removed player's id is never given to someone else,
    // and a phone still holding the removed player's cookie can't become them.
    id: integer('id').primaryKey({ autoIncrement: true }),
    // The name as the player typed it, shown on screens.
    name: text('name').notNull(),
    // `nameKey(name)` (src/game/names.ts): names are unique ignoring capitals.
    nameKey: text('name_key').notNull().unique(),
    // The 4-digit PIN as a salted SHA-256 hash, both hex (unit 3.01).
    pinHash: text('pin_hash').notNull(),
    pinSalt: text('pin_salt').notNull(),
    // Null until assigned, together: at the start of Game on, or on joining
    // after it. Never changed once set; a trigger in migrations/0002 refuses it.
    challenge: integer('challenge'),
    decoy: integer('decoy'),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    joinedAt: integer('joined_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  () => [
    check('players_challenge_valid', inContentRange('challenge')),
    check('players_decoy_valid', inContentRange('decoy')),
    check('players_assigned_together', sql`(challenge is null) = (decoy is null)`),
    check('players_completed_when_assigned', sql`completed = 0 or challenge is not null`),
  ],
)

// A player's current guess about another player's challenge. The primary key
// allows one active guess per other player: changing it updates the row,
// clearing it deletes the row. Removing a player removes the accusations they
// made and the ones made about them.
export const accusations = sqliteTable(
  'accusations',
  {
    accuserId: integer('accuser_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    accusedId: integer('accused_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    challenge: integer('challenge').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.accuserId, t.accusedId] }),
    check('accusations_not_self', sql`accuser_id <> accused_id`),
    check('accusations_challenge_valid', inContentRange('challenge')),
    // For "who detected this player" and removing a player.
    index('accusations_accused_idx').on(t.accusedId),
  ],
)

export type Player = typeof players.$inferSelect
export type Accusation = typeof accusations.$inferSelect

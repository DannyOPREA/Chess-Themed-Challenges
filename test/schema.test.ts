import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/db/client'
import { getPhase } from '../src/db/game'
import { accusations, game, players } from '../src/db/schema'
import { nameKey } from '../src/game/names'
import { resetDb } from './reset-db'

const db = createDb(env.DB)

beforeEach(resetDb)

// Asserts the database refused a write, and why: Drizzle wraps D1's error, so
// the constraint's name is in the error's cause.
const refused = async (write: Promise<unknown>, reason: string) => {
  const error: unknown = await write.then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(error, 'the write should have been refused').toBeInstanceOf(Error)
  const { message, cause } = error as Error
  expect(`${message} ${String(cause)}`).toContain(reason)
}

const addPlayer = async (name: string, assigned?: { challenge: number; decoy: number }) => {
  const [player] = await db
    .insert(players)
    .values({ name, nameKey: nameKey(name), pinHash: 'hash', pinSalt: 'salt', ...assigned })
    .returning()
  if (!player) throw new Error('insert returned nothing')
  return player
}

describe('the game row', () => {
  it('starts in the Lobby phase', async () => {
    expect(await getPhase(db)).toBe('lobby')
  })

  it('keeps the phase the host sets', async () => {
    await db.update(game).set({ phase: 'game_on' }).where(eq(game.id, 1))
    expect(await getPhase(db)).toBe('game_on')
  })

  it('is the only game', async () => {
    await refused(db.insert(game).values({ id: 2 }), 'game_single_row')
  })

  it('refuses a phase that does not exist', async () => {
    await refused(env.DB.prepare("UPDATE game SET phase = 'finished'").run(), 'game_phase_valid')
  })
})

describe('players', () => {
  it('start unassigned and not completed', async () => {
    const player = await addPlayer('Player A')
    expect(player).toMatchObject({ name: 'Player A', challenge: null, decoy: null, completed: false })
    expect(player.joinedAt).toBeInstanceOf(Date)
  })

  it('have names that are unique ignoring capitals and extra spaces', async () => {
    await addPlayer('Player A')
    await refused(addPlayer('PLAYER a'), 'UNIQUE constraint failed: players.name_key')
    await refused(addPlayer(' Player  A '), 'UNIQUE constraint failed: players.name_key')
    expect(nameKey('Player A')).toBe(nameKey('pLaYeR a'))
    expect(nameKey('  Player \t A ')).toBe('player a')
    expect(nameKey('Player A')).not.toBe(nameKey('Player B'))
  })

  it('only hold challenge and decoy numbers 1 to 20', async () => {
    await addPlayer('Player A', { challenge: 1, decoy: 20 })
    await refused(addPlayer('Player B', { challenge: 0, decoy: 1 }), 'players_challenge_valid')
    await refused(addPlayer('Player C', { challenge: 1, decoy: 21 }), 'players_decoy_valid')
  })

  it('get a challenge and a decoy together, or neither', async () => {
    await refused(
      db.insert(players).values({ name: 'Player A', nameKey: 'player a', pinHash: 'h', pinSalt: 's', challenge: 1 }),
      'players_assigned_together',
    )
    await refused(
      db.insert(players).values({ name: 'Player B', nameKey: 'player b', pinHash: 'h', pinSalt: 's', decoy: 1 }),
      'players_assigned_together',
    )
  })

  it('can only be marked completed once assigned', async () => {
    const lobby = await addPlayer('Player A')
    await refused(
      db.update(players).set({ completed: true }).where(eq(players.id, lobby.id)),
      'players_completed_when_assigned',
    )
    const assigned = await addPlayer('Player B', { challenge: 2, decoy: 3 })
    await db.update(players).set({ completed: true }).where(eq(players.id, assigned.id))
    await db.update(players).set({ completed: false }).where(eq(players.id, assigned.id))
  })

  it('keep their challenge and decoy once assigned', async () => {
    const player = await addPlayer('Player A')
    await db.update(players).set({ challenge: 5, decoy: 6 }).where(eq(players.id, player.id))
    await refused(
      db.update(players).set({ challenge: 7 }).where(eq(players.id, player.id)),
      'players_assignment_final',
    )
    await refused(
      db.update(players).set({ decoy: 7 }).where(eq(players.id, player.id)),
      'players_assignment_final',
    )
    await refused(
      db.update(players).set({ challenge: null, decoy: null }).where(eq(players.id, player.id)),
      'players_assignment_final',
    )
    // Other changes, such as a PIN reset or completion, still work.
    await db.update(players).set({ pinHash: 'new', completed: true }).where(eq(players.id, player.id))
    const [row] = await db.select().from(players).where(eq(players.id, player.id))
    expect(row).toMatchObject({ challenge: 5, decoy: 6, pinHash: 'new', completed: true })
  })

  it("never get a removed player's id", async () => {
    await addPlayer('Player A')
    const removed = await addPlayer('Player B')
    await db.delete(players).where(eq(players.id, removed.id))
    const next = await addPlayer('Player C')
    expect(next.id).toBeGreaterThan(removed.id)
  })
})

describe('accusations', () => {
  it('hold one active guess per other player, which can change and clear', async () => {
    const a = await addPlayer('Player A')
    const b = await addPlayer('Player B')
    await db.insert(accusations).values({ accuserId: a.id, accusedId: b.id, challenge: 3 })
    await refused(
      db.insert(accusations).values({ accuserId: a.id, accusedId: b.id, challenge: 4 }),
      'UNIQUE constraint failed',
    )

    await db
      .insert(accusations)
      .values({ accuserId: a.id, accusedId: b.id, challenge: 4 })
      .onConflictDoUpdate({
        target: [accusations.accuserId, accusations.accusedId],
        set: { challenge: 4 },
      })
    expect(await db.select().from(accusations)).toEqual([
      { accuserId: a.id, accusedId: b.id, challenge: 4 },
    ])

    await db.delete(accusations).where(eq(accusations.accuserId, a.id))
    expect(await db.select().from(accusations)).toEqual([])
  })

  it('are refused against yourself', async () => {
    const a = await addPlayer('Player A')
    await refused(
      db.insert(accusations).values({ accuserId: a.id, accusedId: a.id, challenge: 1 }),
      'accusations_not_self',
    )
  })

  it('are refused for a challenge number outside 1 to 20, or a player who does not exist', async () => {
    const a = await addPlayer('Player A')
    const b = await addPlayer('Player B')
    await refused(
      db.insert(accusations).values({ accuserId: a.id, accusedId: b.id, challenge: 21 }),
      'accusations_challenge_valid',
    )
    await refused(
      db.insert(accusations).values({ accuserId: a.id, accusedId: b.id + 100, challenge: 1 }),
      'FOREIGN KEY constraint failed',
    )
  })

  it("go when a player is removed, both the player's own and those about them", async () => {
    const a = await addPlayer('Player A')
    const b = await addPlayer('Player B')
    const c = await addPlayer('Player C')
    await db.insert(accusations).values([
      { accuserId: a.id, accusedId: b.id, challenge: 1 },
      { accuserId: b.id, accusedId: a.id, challenge: 2 },
      { accuserId: b.id, accusedId: c.id, challenge: 3 },
      { accuserId: c.id, accusedId: a.id, challenge: 4 },
    ])
    await db.delete(players).where(eq(players.id, b.id))
    expect(await db.select().from(accusations)).toEqual([
      { accuserId: c.id, accusedId: a.id, challenge: 4 },
    ])
  })
})

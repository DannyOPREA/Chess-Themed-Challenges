import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { hashPin, pinSchema, verifyPin } from '../src/auth/pin'
import { createDb } from '../src/db/client'
import { assignLateJoiner, createPlayer, ensureAssigned, findPlayerByName } from '../src/db/players'
import { game, players } from '../src/db/schema'
import { isLeastHeld } from '../src/game/assignment'
import { nameKey } from '../src/game/names'
import { resetDb } from './reset-db'

const db = createDb(env.DB)

beforeEach(resetDb)

const addPlayer = async (name: string, assigned?: { challenge: number; decoy: number }) => {
  const [player] = await db
    .insert(players)
    .values({ name, nameKey: nameKey(name), pinHash: 'hash', pinSalt: 'salt', ...assigned })
    .returning()
  if (!player) throw new Error('insert returned nothing')
  return player
}

describe('PINs', () => {
  it('are hashed with a fresh salt each time and checked against the hash', async () => {
    const first = await hashPin('1234')
    const second = await hashPin('1234')
    expect(first.pinSalt).not.toBe(second.pinSalt)
    expect(first.pinHash).not.toBe(second.pinHash)
    expect(await verifyPin('1234', first)).toBe(true)
    expect(await verifyPin('1234', second)).toBe(true)
    expect(await verifyPin('1235', first)).toBe(false)
    expect(await verifyPin('1234', { pinHash: first.pinHash, pinSalt: second.pinSalt })).toBe(false)
    expect(await verifyPin('1234', { pinHash: 'short', pinSalt: first.pinSalt })).toBe(false)
  })

  it('must be exactly 4 digits', () => {
    for (const pin of ['0000', '1234', '9999']) expect(pinSchema.safeParse(pin).success).toBe(true)
    for (const pin of ['', '123', '12345', 'abcd', '12 4', '１２３４', ' 1234']) {
      expect(pinSchema.safeParse(pin).success).toBe(false)
    }
  })
})

describe('creating and finding players', () => {
  it('finds a player by name ignoring capitals and spaces', async () => {
    const sam = await addPlayer('Sam Smith')
    expect((await findPlayerByName(db, '  SAM   smith '))?.id).toBe(sam.id)
    expect(await findPlayerByName(db, 'Sam')).toBeUndefined()
  })

  it('creates nothing when the name is taken', async () => {
    await addPlayer('Sam')
    expect(await createPlayer(db, 'SAM', await hashPin('1234'))).toBeUndefined()
    expect(await db.select().from(players)).toHaveLength(1)
  })
})

describe('assigning a late joiner', () => {
  it('waits for Game on, and leaves an assigned player as they are', async () => {
    const sam = await addPlayer('Sam')
    expect(await ensureAssigned(db, sam)).toEqual(sam)
    await db.update(game).set({ phase: 'game_on' })
    const assigned = await addPlayer('Alex', { challenge: 2, decoy: 3 })
    expect(await ensureAssigned(db, assigned)).toEqual(assigned)
    const late = await ensureAssigned(db, sam)
    expect(late?.challenge).not.toBeNull()
    expect(late?.challenge).not.toBe(2)
    expect(late?.decoy).not.toBe(3)
  })

  it.each(['accusations_closed', 'reveal'] as const)('does not assign in %s', async (phase) => {
    const sam = await addPlayer('Sam')
    await db.update(game).set({ phase })
    expect(await ensureAssigned(db, sam)).toEqual(sam)
  })

  it('gives joiners racing for the same number different numbers', async () => {
    // A random source of 0 makes every joiner pick the lowest least-held
    // number, so without the clash check they would all get challenge 1.
    for (let round = 0; round < 5; round++) {
      await resetDb()
      const joiners = await Promise.all(Array.from({ length: 10 }, (_, i) => addPlayer(`Racer ${i}`)))
      const assigned = await Promise.all(joiners.map((j) => assignLateJoiner(db, j.id, { random: () => 0 })))
      expect(new Set(assigned.map((p) => p?.challenge)).size).toBe(10)
      expect(new Set(assigned.map((p) => p?.decoy)).size).toBe(10)
    }
  })

  it('keeps reuse even beyond 20 players when joiners race', async () => {
    for (let i = 1; i <= 20; i++) await addPlayer(`Player ${i}`, { challenge: i, decoy: i })
    const joiners = await Promise.all(Array.from({ length: 5 }, (_, i) => addPlayer(`Racer ${i}`)))
    await Promise.all(joiners.map((j) => assignLateJoiner(db, j.id, { random: () => 0 })))
    const everyone = await db.select().from(players)
    for (const joiner of joiners) {
      const me = everyone.find((p) => p.id === joiner.id)!
      const others = everyone.filter((p) => p.id !== joiner.id)
      expect(isLeastHeld(others, { challenge: me.challenge!, decoy: me.decoy! })).toBe(true)
    }
  })

  it('returns nothing for a player who was removed', async () => {
    const sam = await addPlayer('Sam')
    await db.delete(players).where(eq(players.id, sam.id))
    expect(await assignLateJoiner(db, sam.id)).toBeUndefined()
  })

  it('never changes a player who was assigned meanwhile', async () => {
    const sam = await addPlayer('Sam', { challenge: 4, decoy: 5 })
    expect(await assignLateJoiner(db, sam.id)).toEqual(sam)
  })
})

import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { hashPin } from '../src/auth/pin'
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

  it('creates nothing once accusations close, even if the phase was read earlier', async () => {
    for (const phase of ['accusations_closed', 'reveal'] as const) {
      await db.update(game).set({ phase })
      expect(await createPlayer(db, 'Sam', await hashPin('1234'))).toBeUndefined()
    }
    expect(await db.select().from(players)).toEqual([])
  })

  it('creates players in the Lobby and during Game on', async () => {
    expect((await createPlayer(db, 'Sam', await hashPin('1234')))?.name).toBe('Sam')
    await db.update(game).set({ phase: 'game_on' })
    expect((await createPlayer(db, 'Alex', await hashPin('1234')))?.name).toBe('Alex')
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
      await db.update(game).set({ phase: 'game_on' })
      const joiners = await Promise.all(Array.from({ length: 10 }, (_, i) => addPlayer(`Racer ${i}`)))
      const assigned = await Promise.all(joiners.map((j) => assignLateJoiner(db, j.id, { random: () => 0 })))
      expect(new Set(assigned.map((p) => p?.challenge)).size).toBe(10)
      expect(new Set(assigned.map((p) => p?.decoy)).size).toBe(10)
    }
  })

  it('keeps reuse even beyond 20 players when joiners race', async () => {
    await db.update(game).set({ phase: 'game_on' })
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

  it('writes nothing once the phase has moved on, even if Game on was read earlier', async () => {
    const sam = await addPlayer('Sam')
    await db.update(game).set({ phase: 'accusations_closed' })
    expect(await assignLateJoiner(db, sam.id)).toEqual(sam)
  })

  it('writes nothing if the host closes accusations between the read and the write', async () => {
    await db.update(game).set({ phase: 'game_on' })
    const sam = await addPlayer('Sam')
    // The host's phase change lands just after the late joiner's read.
    const racingDb = new Proxy(db, {
      get(target, key, receiver) {
        if (key !== 'batch') return Reflect.get(target, key, receiver)
        return async (...args: Parameters<typeof db.batch>) => {
          const result = await target.batch(...args)
          await target.update(game).set({ phase: 'accusations_closed' })
          return result
        }
      },
    })
    expect(await assignLateJoiner(racingDb, sam.id)).toEqual(sam)
  })

  it('returns nothing for a player who was removed', async () => {
    const sam = await addPlayer('Sam')
    await db.delete(players).where(eq(players.id, sam.id))
    expect(await assignLateJoiner(db, sam.id)).toBeUndefined()
  })

  it('never changes a player who was assigned meanwhile', async () => {
    await db.update(game).set({ phase: 'game_on' })
    const sam = await addPlayer('Sam', { challenge: 4, decoy: 5 })
    expect(await assignLateJoiner(db, sam.id)).toEqual(sam)
  })
})

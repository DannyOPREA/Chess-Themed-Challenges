import { describe, expect, it } from 'vitest'
import {
  type AssignmentSlot,
  CONTENT_SIZE,
  type RandomSource,
  assignOne,
  assignPlayers,
  isLeastHeld,
} from '../src/game/assignment'

// A small seeded random source (mulberry32), so failures can be reproduced.
function seeded(seed: number): RandomSource {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Player = AssignmentSlot & { id: number }

function lobby(size: number): Player[] {
  return Array.from({ length: size }, (_, i) => ({ id: i + 1, challenge: null, decoy: null }))
}

function counts(values: readonly number[]): number[] {
  const result = new Array<number>(CONTENT_SIZE).fill(0)
  for (const v of values) result[v - 1]! += 1
  return result
}

function expectInRange(values: readonly number[]) {
  for (const v of values) {
    expect(Number.isInteger(v)).toBe(true)
    expect(v).toBeGreaterThanOrEqual(1)
    expect(v).toBeLessThanOrEqual(CONTENT_SIZE)
  }
}

const SEEDS = Array.from({ length: 25 }, (_, i) => i + 1)

describe('assigning the lobby at the start of Game on', () => {
  it('gives 1 to 20 players all different challenges and all different decoys', () => {
    for (let size = 1; size <= 20; size++) {
      for (const seed of SEEDS) {
        const assigned = assignPlayers(lobby(size), { random: seeded(seed * 100 + size) })
        expect(assigned.map((p) => p.id)).toEqual(lobby(size).map((p) => p.id))
        const challenges = assigned.map((p) => p.challenge)
        const decoys = assigned.map((p) => p.decoy)
        expectInRange(challenges)
        expectInRange(decoys)
        expect(new Set(challenges).size).toBe(size)
        expect(new Set(decoys).size).toBe(size)
      }
    }
  })

  it('uses every challenge and decoy exactly once with exactly 20 players', () => {
    const assigned = assignPlayers(lobby(20), { random: seeded(20) })
    expect(counts(assigned.map((p) => p.challenge))).toEqual(new Array(20).fill(1))
    expect(counts(assigned.map((p) => p.decoy))).toEqual(new Array(20).fill(1))
  })

  it('reuses challenges and decoys only beyond 20 players, as evenly as possible', () => {
    for (const size of [21, 25, 39, 40, 41, 60]) {
      for (const seed of SEEDS) {
        const assigned = assignPlayers(lobby(size), { random: seeded(seed * 1000 + size) })
        expect(assigned).toHaveLength(size)
        for (const values of [assigned.map((p) => p.challenge), assigned.map((p) => p.decoy)]) {
          expectInRange(values)
          const c = counts(values)
          // Every number is used, and no number is used more than once more
          // than any other: 21 players means one number is held twice.
          expect(Math.min(...c)).toBe(Math.floor(size / 20))
          expect(Math.max(...c)).toBe(Math.ceil(size / 20))
        }
      }
    }
  })

  // Unseeded on purpose, to check the default; it can't flake, because
  // uniqueness holds for every random sequence.
  it('works with the default random source', () => {
    for (let i = 0; i < 50; i++) {
      const assigned = assignPlayers(lobby(20))
      expect(new Set(assigned.map((p) => p.challenge)).size).toBe(20)
      expect(new Set(assigned.map((p) => p.decoy)).size).toBe(20)
    }
  })

  it('keeps the other fields of each player', () => {
    const [assigned] = assignPlayers([{ id: 7, name: 'Player 7', challenge: null, decoy: null }])
    expect(assigned).toMatchObject({ id: 7, name: 'Player 7' })
  })

  it('returns nothing for an empty lobby', () => {
    expect(assignPlayers([])).toEqual([])
  })
})

describe('never reassigning', () => {
  it('leaves assigned players out of the result and avoids their numbers', () => {
    for (const seed of SEEDS) {
      const players: Player[] = [
        { id: 1, challenge: 3, decoy: 17 },
        { id: 2, challenge: 11, decoy: 4 },
        ...lobby(18).map((p) => ({ ...p, id: p.id + 2 })),
      ]
      const assigned = assignPlayers(players, { random: seeded(seed) })
      expect(assigned.map((p) => p.id)).toEqual(players.slice(2).map((p) => p.id))
      const challenges = [3, 11, ...assigned.map((p) => p.challenge)]
      const decoys = [17, 4, ...assigned.map((p) => p.decoy)]
      expect(new Set(challenges).size).toBe(20)
      expect(new Set(decoys).size).toBe(20)
    }
  })

  it('returns nothing when everyone is already assigned', () => {
    const players = assignPlayers(lobby(20), { random: seeded(1) })
    expect(assignPlayers(players, { random: seeded(2) })).toEqual([])
  })

  it('does not change the players it is given', () => {
    const players = [{ id: 1, challenge: 5, decoy: 6 }, ...lobby(3).map((p) => ({ ...p, id: p.id + 1 }))]
    const before = structuredClone(players)
    assignPlayers(players, { random: seeded(3) })
    expect(players).toEqual(before)
  })

  it('fills in only the missing half of a half-assigned player', () => {
    for (const seed of SEEDS) {
      const players: Player[] = [
        { id: 1, challenge: 9, decoy: null },
        { id: 2, challenge: null, decoy: 9 },
      ]
      const [one, two] = assignPlayers(players, { random: seeded(seed) })
      expect(one!.challenge).toBe(9)
      expect(one!.decoy).not.toBe(9)
      expect(two!.decoy).toBe(9)
      expect(two!.challenge).not.toBe(9)
    }
  })
})

describe('late joiners', () => {
  it('get an unused challenge and decoy while there are 20 or fewer players', () => {
    for (const seed of SEEDS) {
      const random = seeded(seed)
      const players: AssignmentSlot[] = assignPlayers(lobby(5), { random })
      for (let joined = 6; joined <= 20; joined++) {
        const next = assignOne(players, { random })
        expect(players.map((p) => p.challenge)).not.toContain(next.challenge)
        expect(players.map((p) => p.decoy)).not.toContain(next.decoy)
        expectInRange([next.challenge, next.decoy])
        players.push(next)
      }
      expect(new Set(players.map((p) => p.challenge)).size).toBe(20)
      expect(new Set(players.map((p) => p.decoy)).size).toBe(20)
    }
  })

  it('get the one challenge and decoy left free when 19 are held', () => {
    for (const seed of SEEDS) {
      const players = assignPlayers(lobby(20), { random: seeded(seed) })
      const [removed] = players.splice(seed % 20, 1)
      const next = assignOne(players, { random: seeded(seed + 1) })
      expect(next).toEqual({ challenge: removed!.challenge, decoy: removed!.decoy })
    }
  })

  it('beyond 20 players get a number freed by a removed player', () => {
    for (const seed of SEEDS) {
      // 21 players: one number is held twice, the rest once. Removing a player
      // who alone holds a number frees it, and the next joiner must get it.
      const players = assignPlayers(lobby(21), { random: seeded(seed) })
      const held = counts(players.map((p) => p.challenge))
      const removed = players.find((p) => held[p.challenge - 1] === 1)!
      const remaining = players.filter((p) => p !== removed)
      expect(assignOne(remaining, { random: seeded(seed + 1) }).challenge).toBe(removed.challenge)
    }
  })

  it('beyond 20 players get a number that as few others hold as possible', () => {
    for (const seed of SEEDS) {
      const random = seeded(seed)
      const players: AssignmentSlot[] = assignPlayers(lobby(20), { random })
      for (let joined = 21; joined <= 45; joined++) {
        const next = assignOne(players, { random })
        players.push(next)
        for (const values of [players.map((p) => p.challenge!), players.map((p) => p.decoy!)]) {
          const c = counts(values)
          expect(Math.max(...c) - Math.min(...c)).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('ignore lobby players who have no numbers yet', () => {
    const players: AssignmentSlot[] = [
      { challenge: 2, decoy: 3 },
      { challenge: null, decoy: null },
    ]
    for (const seed of SEEDS) {
      const next = assignOne(players, { random: seeded(seed) })
      expect(next.challenge).not.toBe(2)
      expect(next.decoy).not.toBe(3)
    }
  })

  it('get a first challenge and decoy when nobody else is assigned', () => {
    const next = assignOne([])
    expectInRange([next.challenge, next.decoy])
  })
})

describe('randomness', () => {
  it('picks every challenge and decoy for a first player over many draws', () => {
    const random = seeded(42)
    const challenges = new Set<number>()
    const decoys = new Set<number>()
    for (let i = 0; i < 1000; i++) {
      const next = assignOne([], { random })
      challenges.add(next.challenge)
      decoys.add(next.decoy)
    }
    expect(challenges.size).toBe(20)
    expect(decoys.size).toBe(20)
  })

  it('does not tie a player’s challenge to their decoy or their place in the lobby', () => {
    const random = seeded(7)
    let sameNumber = 0
    let challengeIsPosition = 0
    for (let i = 0; i < 200; i++) {
      const assigned = assignPlayers(lobby(20), { random })
      for (const p of assigned) {
        if (p.challenge === p.decoy) sameNumber++
        if (p.challenge === p.id) challengeIsPosition++
      }
    }
    // 4000 players; a fixed pattern would make these 4000, chance makes them about 200.
    expect(sameNumber).toBeLessThan(400)
    expect(challengeIsPosition).toBeLessThan(400)
  })

  it('stays in range at the edges of the random source', () => {
    for (const edge of [-0.5, 0, 0.5, 0.999999999, 1, 1.5]) {
      const assigned = assignPlayers(lobby(25), { random: () => edge })
      expectInRange(assigned.map((p) => p.challenge))
      expectInRange(assigned.map((p) => p.decoy))
      expect(new Set(assigned.slice(0, 20).map((p) => p.challenge)).size).toBe(20)
    }
  })
})

describe('bad stored values', () => {
  it('treats a missing (undefined) value like null', () => {
    const players = [{ challenge: undefined, decoy: undefined }] as unknown as AssignmentSlot[]
    const assigned = assignPlayers(players, { random: seeded(1) })
    expect(assigned).toHaveLength(1)
    expectInRange([assigned[0]!.challenge, assigned[0]!.decoy])
  })

  it('refuses numbers outside 1 to 20 instead of treating them as free', () => {
    for (const bad of [0, 21, -1, 1.5, Number.NaN]) {
      const players: AssignmentSlot[] = [{ challenge: bad, decoy: 1 }, { challenge: null, decoy: null }]
      expect(() => assignPlayers(players)).toThrow(RangeError)
      expect(() => assignOne(players)).toThrow(RangeError)
      expect(() => isLeastHeld(players, { challenge: 2, decoy: 2 })).toThrow(RangeError)
      expect(() => isLeastHeld([], { challenge: bad, decoy: 2 })).toThrow(RangeError)
    }
  })
})

describe('re-checking a late joiner after a write', () => {
  it('passes every fresh pick', () => {
    for (const size of [0, 1, 7, 19, 20, 21, 33, 40]) {
      for (const seed of SEEDS) {
        const random = seeded(seed * 100 + size)
        const players: AssignmentSlot[] = assignPlayers(lobby(size), { random })
        expect(isLeastHeld(players, assignOne(players, { random }))).toBe(true)
      }
    }
  })

  it('catches another joiner who took the same free challenge or decoy', () => {
    const players: AssignmentSlot[] = assignPlayers(lobby(10), { random: seeded(1) })
    const mine = assignOne(players, { random: seeded(2) })
    // Another phone joined at the same moment and wrote the same numbers.
    const rival = { ...mine }
    expect(isLeastHeld([...players, rival], mine)).toBe(false)
    expect(isLeastHeld([...players, { ...rival, decoy: null }], mine)).toBe(false)
    expect(isLeastHeld([...players, { ...rival, challenge: null }], mine)).toBe(false)
    // Picking again with everyone else in view gives numbers that pass.
    const again = assignOne([...players, rival], { random: seeded(3) })
    expect(isLeastHeld([...players, rival], again)).toBe(true)
  })

  it('allows sharing beyond 20 players, when every number is already held', () => {
    const players: AssignmentSlot[] = assignPlayers(lobby(20), { random: seeded(4) })
    expect(isLeastHeld(players, { challenge: 5, decoy: 9 })).toBe(true)
    players.push({ challenge: 5, decoy: 9 })
    expect(isLeastHeld(players, { challenge: 5, decoy: 1 })).toBe(false)
  })

  it('can always be met after removals leave reuse uneven', () => {
    for (const seed of SEEDS) {
      // 21 players, then two who alone hold a challenge are removed: 19
      // players hold 18 challenges, one of them twice. The table stays
      // uneven, as assignments never change, but a joiner's pick still passes.
      const players = assignPlayers(lobby(21), { random: seeded(seed) })
      const held = counts(players.map((p) => p.challenge))
      const removed = players.filter((p) => held[p.challenge - 1] === 1).slice(0, 2)
      const remaining = players.filter((p) => !removed.includes(p))
      const joiner = assignOne(remaining, { random: seeded(seed + 1) })
      expect(removed.map((p) => p.challenge)).toContain(joiner.challenge)
      expect(isLeastHeld(remaining, joiner)).toBe(true)
    }
  })

  it('ignores players not yet assigned', () => {
    expect(isLeastHeld([{ challenge: 3, decoy: 4 }, { challenge: null, decoy: null }], { challenge: 1, decoy: 1 })).toBe(true)
  })
})

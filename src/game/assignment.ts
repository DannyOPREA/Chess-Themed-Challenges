// Random challenge and decoy assignment (docs/scope.md, "Assignment").
//
// Challenges and decoys are numbers 1 to 20, drawn independently. Each new
// number is picked at random from the ones the fewest players hold: while
// there are 20 or fewer players that is always an unused number, so everyone's
// challenge and decoy differ from everyone else's; beyond 20, numbers are
// reused as evenly as possible. Numbers already held are never changed.

/** How many challenges (and decoys) the content has. */
export const CONTENT_SIZE = 20

/** Returns a number in [0, 1), like `Math.random`. Tests pass a seeded one. */
export type RandomSource = () => number

export type Assignment = { challenge: number; decoy: number }

/** A player as stored: `null` until they have been assigned. */
export type AssignmentSlot = { challenge: number | null; decoy: number | null }

export type AssignOptions = {
  /** Defaults to `Math.random`. */
  random?: RandomSource
}

/**
 * Picks one number from 1 to CONTENT_SIZE at random among those held by the
 * fewest entries of `held`. Values outside 1 to CONTENT_SIZE are ignored.
 */
function pickLeastUsed(held: readonly (number | null)[], random: RandomSource): number {
  const counts = new Array<number>(CONTENT_SIZE).fill(0)
  for (const n of held) {
    if (n !== null && Number.isInteger(n) && n >= 1 && n <= CONTENT_SIZE) counts[n - 1]! += 1
  }
  const fewest = Math.min(...counts)
  const candidates: number[] = []
  counts.forEach((count, i) => {
    if (count === fewest) candidates.push(i + 1)
  })
  // Clamped so a random source that returns exactly 1 can't index past the end.
  const index = Math.min(Math.floor(random() * candidates.length), candidates.length - 1)
  return candidates[index]!
}

/**
 * Assigns every player in `players` who has no challenge or no decoy yet, and
 * returns just those players, in input order, with both values filled in.
 * Values a player already holds are kept unchanged, and every number held by
 * any player in the list counts as taken. Use it at the start of Game on with
 * every player in the lobby. Removed players must be left out of the list, so
 * their numbers become free again.
 */
export function assignPlayers<T extends AssignmentSlot>(
  players: readonly T[],
  options: AssignOptions = {},
): (T & Assignment)[] {
  const random = options.random ?? Math.random
  const challenges = players.map((p) => p.challenge)
  const decoys = players.map((p) => p.decoy)
  const assigned: (T & Assignment)[] = []
  for (const player of players) {
    if (player.challenge !== null && player.decoy !== null) continue
    let { challenge, decoy } = player
    if (challenge === null) {
      challenge = pickLeastUsed(challenges, random)
      challenges.push(challenge)
    }
    if (decoy === null) {
      decoy = pickLeastUsed(decoys, random)
      decoys.push(decoy)
    }
    assigned.push({ ...player, challenge, decoy })
  }
  return assigned
}

/**
 * Picks a challenge and decoy for one new player (a late joiner), given every
 * current player, assigned or not. Removed players must be left out.
 */
export function assignOne(
  current: readonly AssignmentSlot[],
  options: AssignOptions = {},
): Assignment {
  const random = options.random ?? Math.random
  return {
    challenge: pickLeastUsed(current.map((p) => p.challenge), random),
    decoy: pickLeastUsed(current.map((p) => p.decoy), random),
  }
}

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
 * How many of `held` hold each number, index `n - 1` for number `n`. Missing
 * values (`null` or `undefined`) are skipped; anything else outside 1 to
 * CONTENT_SIZE is a corrupt row and throws, rather than being quietly treated
 * as free.
 */
function countHeld(held: readonly (number | null | undefined)[]): number[] {
  const counts = new Array<number>(CONTENT_SIZE).fill(0)
  for (const n of held) {
    if (n == null) continue
    if (!Number.isInteger(n) || n < 1 || n > CONTENT_SIZE) {
      throw new RangeError(`Assigned number ${n} is not between 1 and ${CONTENT_SIZE}`)
    }
    counts[n - 1]! += 1
  }
  return counts
}

/** Picks one number at random among those the fewest entries of `held` hold. */
function pickLeastUsed(held: readonly (number | null)[], random: RandomSource): number {
  const counts = countHeld(held)
  const fewest = Math.min(...counts)
  const candidates: number[] = []
  counts.forEach((count, i) => {
    if (count === fewest) candidates.push(i + 1)
  })
  // Clamped so a random source outside [0, 1) can't index past either end.
  const index = Math.max(0, Math.min(Math.floor(random() * candidates.length), candidates.length - 1))
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
    if (player.challenge != null && player.decoy != null) continue
    let { challenge, decoy } = player
    if (challenge == null) {
      challenge = pickLeastUsed(challenges, random)
      challenges.push(challenge)
    }
    if (decoy == null) {
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

/**
 * Whether the players' numbers follow the rule above: no challenge, and no
 * decoy, is held by more than one player more than any other. With 20 or
 * fewer players that means no two share a challenge or a decoy. Callers use
 * it to re-check after writing, because two phones joining at the same moment
 * can both pick from the same free numbers; a late joiner whose new numbers
 * fail the check hasn't been shown them yet and can safely pick again.
 */
export function isEvenlyAssigned(players: readonly AssignmentSlot[]): boolean {
  return [players.map((p) => p.challenge), players.map((p) => p.decoy)].every((held) => {
    const counts = countHeld(held)
    return Math.max(...counts) - Math.min(...counts) <= 1
  })
}

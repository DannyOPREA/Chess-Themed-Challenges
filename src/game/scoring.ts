// Detection and scoring, exactly as docs/scope.md ("Detection and scoring").
// Pure functions over plain data: the reveal (unit 3.05) loads the players and
// their final accusations from the database and passes them in.

// A player at the end of the game. Challenges and decoys are numbers 1 to 20
// (the content's order), as everywhere else in the app.
export type ScoringPlayer = {
  id: number
  name: string
  challenge: number
  decoy: number
  completed: boolean
}

// A player's final guess about another player: "accused's challenge is
// `challenge`". Each player has at most one per other player.
export type ScoringAccusation = {
  accuserId: number
  accusedId: number
  challenge: number
}

// The scoring table in docs/scope.md. The decoy is worth nothing.
export const POINTS = {
  completedUndetected: 5,
  completedDetected: 1,
  notCompleted: 0,
  correctAccusation: 2,
  wrongAccusation: -1,
} as const

// One accusation in a player's breakdown, named for the reveal.
export type AccusationResult = {
  accusedId: number
  accusedName: string
  // The challenge the accuser guessed.
  guessed: number
  // The accused player's real challenge (the same as `guessed` when correct).
  actual: number
}

export type PlayerScore = {
  id: number
  name: string
  challenge: number
  decoy: number
  completed: boolean
  // True when at least one other player's final guess about this player is right.
  detected: boolean
  // Who guessed this player's challenge correctly, by name.
  detectedBy: { id: number; name: string }[]
  // This player's own accusations, by the accused player's name.
  correctAccusations: AccusationResult[]
  wrongAccusations: AccusationResult[]
  challengePoints: number
  accusationPoints: number
  total: number
  // 1 for the top score. Tied players share a rank and the next rank skips
  // (1, 1, 3).
  rank: number
}

const byName = (a: { id: number; name: string }, b: { id: number; name: string }) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id - b.id

// Keeps the accusations that count: both players still in the game, and not
// about oneself. Accusations by or about a removed player are ignored. Throws if
// a player has more than one guess about the same player, which the database
// never allows, because there is no way to tell which one is final.
function validAccusations(players: Map<number, ScoringPlayer>, accusations: ScoringAccusation[]) {
  const seen = new Set<string>()
  return accusations.filter((a) => {
    if (!players.has(a.accuserId) || !players.has(a.accusedId) || a.accuserId === a.accusedId) {
      return false
    }
    const key = `${a.accuserId}:${a.accusedId}`
    if (seen.has(key)) {
      throw new Error(`Player ${a.accuserId} has more than one accusation about player ${a.accusedId}`)
    }
    seen.add(key)
    return true
  })
}

// For each player id, the ids of the other players whose final guess about
// them is correct. A player is detected when this list is not empty.
export function detect(
  players: ScoringPlayer[],
  accusations: ScoringAccusation[],
): Map<number, number[]> {
  const byId = new Map(players.map((p) => [p.id, p]))
  const detectedBy = new Map<number, number[]>(players.map((p) => [p.id, []]))
  for (const a of validAccusations(byId, accusations)) {
    if (byId.get(a.accusedId)!.challenge === a.challenge) {
      detectedBy.get(a.accusedId)!.push(a.accuserId)
    }
  }
  return detectedBy
}

// Scores every player and returns the leaderboard: highest total first, ties
// sharing a rank and listed by name.
export function scoreGame(
  players: ScoringPlayer[],
  accusations: ScoringAccusation[],
): PlayerScore[] {
  const byId = new Map(players.map((p) => [p.id, p]))
  const valid = validAccusations(byId, accusations)
  const detectedBy = detect(players, valid)

  const scores = players.map((player): Omit<PlayerScore, 'rank'> => {
    const detectors = detectedBy
      .get(player.id)!
      .map((id) => ({ id, name: byId.get(id)!.name }))
      .sort(byName)
    const detected = detectors.length > 0

    const correctAccusations: AccusationResult[] = []
    const wrongAccusations: AccusationResult[] = []
    for (const a of valid) {
      if (a.accuserId !== player.id) continue
      const accused = byId.get(a.accusedId)!
      const result = {
        accusedId: accused.id,
        accusedName: accused.name,
        guessed: a.challenge,
        actual: accused.challenge,
      }
      ;(a.challenge === accused.challenge ? correctAccusations : wrongAccusations).push(result)
    }
    const byAccusedName = (x: AccusationResult, y: AccusationResult) =>
      byName({ id: x.accusedId, name: x.accusedName }, { id: y.accusedId, name: y.accusedName })
    correctAccusations.sort(byAccusedName)
    wrongAccusations.sort(byAccusedName)

    const challengePoints = !player.completed
      ? POINTS.notCompleted
      : detected
        ? POINTS.completedDetected
        : POINTS.completedUndetected
    const accusationPoints =
      correctAccusations.length * POINTS.correctAccusation +
      wrongAccusations.length * POINTS.wrongAccusation

    return {
      id: player.id,
      name: player.name,
      challenge: player.challenge,
      decoy: player.decoy,
      completed: player.completed,
      detected,
      detectedBy: detectors,
      correctAccusations,
      wrongAccusations,
      challengePoints,
      accusationPoints,
      total: challengePoints + accusationPoints,
    }
  })

  scores.sort((a, b) => b.total - a.total || byName(a, b))
  // Standard competition ranking: one more than the number of players with a
  // strictly higher total, which in this order is the first index with the
  // same total.
  return scores.map((score) => ({
    ...score,
    rank: scores.findIndex((s) => s.total === score.total) + 1,
  }))
}

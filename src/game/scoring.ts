// Detection and scoring, exactly as docs/scope.md ("Detection and scoring").
// Pure functions over plain data: the reveal (unit 3.05) loads the players and
// their final accusations from the database and passes them in.

// A player at the end of the game. Challenges and decoys are numbers 1 to 20
// (the content's order), as everywhere else in the app. Both are null for a
// player who never got one (unit 3.05): they score no challenge points, can't
// be detected, and guesses about them are ignored.
export type ScoringPlayer = {
  id: number
  name: string
  challenge: number | null
  decoy: number | null
  completed: boolean
}

// A player's final guess about another player: "accused's challenge is
// `challenge`". A cleared guess is simply left out.
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

const CHALLENGE_COUNT = 20

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
  // Null for a player who never got a challenge and decoy.
  challenge: number | null
  decoy: number | null
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

// By name ignoring capitals (names are unique that way), then by id.
const compareNames = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'accent' })
const byName = (a: { id: number; name: string }, b: { id: number; name: string }) =>
  compareNames(a.name, b.name) || a.id - b.id
const byAccusedName = (a: AccusationResult, b: AccusationResult) =>
  compareNames(a.accusedName, b.accusedName) || a.accusedId - b.accusedId

type Judged = ScoringAccusation & { accused: ScoringPlayer; actual: number; correct: boolean }

// Players by id, keeping the first if an id appears twice.
function playersById(players: ScoringPlayer[]) {
  const byId = new Map<number, ScoringPlayer>()
  for (const p of players) if (!byId.has(p.id)) byId.set(p.id, p)
  return byId
}

// The accusations that count, each marked right or wrong. Ignored: guesses by
// or about a player who isn't in the list (removed by the host), guesses about
// a player with no challenge, guesses about oneself, and guesses that aren't a
// challenge number. If a player has more than one guess about the same player,
// the last one in the list counts.
function judge(byId: Map<number, ScoringPlayer>, accusations: ScoringAccusation[]): Judged[] {
  const final = new Map<string, Judged>()
  for (const a of accusations) {
    const accused = byId.get(a.accusedId)
    if (!accused || !byId.has(a.accuserId) || a.accuserId === a.accusedId) continue
    const actual = accused.challenge
    if (actual === null) continue
    if (!Number.isInteger(a.challenge) || a.challenge < 1 || a.challenge > CHALLENGE_COUNT) continue
    const key = `${a.accuserId}:${a.accusedId}`
    final.delete(key)
    final.set(key, { ...a, accused, actual, correct: a.challenge === actual })
  }
  return [...final.values()]
}

// For each player id, the ids (lowest first) of the other players whose final
// guess about them is correct. A player is detected when this list isn't empty.
export function detect(
  players: ScoringPlayer[],
  accusations: ScoringAccusation[],
): Map<number, number[]> {
  const byId = playersById(players)
  const detectedBy = new Map<number, number[]>([...byId.keys()].map((id) => [id, []]))
  for (const a of judge(byId, accusations)) {
    if (a.correct) detectedBy.get(a.accusedId)!.push(a.accuserId)
  }
  for (const ids of detectedBy.values()) ids.sort((x, y) => x - y)
  return detectedBy
}

// Scores every player and returns the leaderboard: highest total first, ties
// sharing a rank and listed by name.
export function scoreGame(
  players: ScoringPlayer[],
  accusations: ScoringAccusation[],
): PlayerScore[] {
  const byId = playersById(players)
  const detectors = new Map<number, { id: number; name: string }[]>()
  const made = new Map<number, { correct: AccusationResult[]; wrong: AccusationResult[] }>()
  for (const id of byId.keys()) {
    detectors.set(id, [])
    made.set(id, { correct: [], wrong: [] })
  }
  for (const a of judge(byId, accusations)) {
    const result = {
      accusedId: a.accused.id,
      accusedName: a.accused.name,
      guessed: a.challenge,
      actual: a.actual,
    }
    const own = made.get(a.accuserId)!
    if (a.correct) {
      own.correct.push(result)
      detectors.get(a.accusedId)!.push({ id: a.accuserId, name: byId.get(a.accuserId)!.name })
    } else {
      own.wrong.push(result)
    }
  }

  const scores = [...byId.values()].map((player): Omit<PlayerScore, 'rank'> => {
    const detectedBy = detectors.get(player.id)!.sort(byName)
    const { correct, wrong } = made.get(player.id)!
    const detected = detectedBy.length > 0
    const challengePoints =
      !player.completed || player.challenge === null
        ? POINTS.notCompleted
        : detected
          ? POINTS.completedDetected
          : POINTS.completedUndetected
    const accusationPoints =
      correct.length * POINTS.correctAccusation + wrong.length * POINTS.wrongAccusation
    return {
      id: player.id,
      name: player.name,
      challenge: player.challenge,
      decoy: player.decoy,
      completed: player.completed,
      detected,
      detectedBy,
      correctAccusations: correct.sort(byAccusedName),
      wrongAccusations: wrong.sort(byAccusedName),
      challengePoints,
      accusationPoints,
      total: challengePoints + accusationPoints,
    }
  })

  // Standard competition ranking: a player's rank is one more than the number
  // of players with a strictly higher total.
  scores.sort((a, b) => b.total - a.total || byName(a, b))
  let rank = 0
  return scores.map((score, i) => {
    if (i === 0 || score.total !== scores[i - 1]!.total) rank = i + 1
    return { ...score, rank }
  })
}

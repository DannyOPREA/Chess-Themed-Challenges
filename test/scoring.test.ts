import { describe, expect, it } from 'vitest'
import {
  POINTS,
  detect,
  scoreGame,
  type ScoringAccusation,
  type ScoringPlayer,
} from '../src/game/scoring'

// Player n has challenge n and decoy 21 - n unless a test says otherwise.
function player(id: number, name: string, completed: boolean, challenge = id): ScoringPlayer {
  return { id, name, challenge, decoy: 21 - challenge, completed }
}

function guess(accuserId: number, accusedId: number, challenge: number): ScoringAccusation {
  return { accuserId, accusedId, challenge }
}

function scoreOf(scores: ReturnType<typeof scoreGame>, id: number) {
  const score = scores.find((s) => s.id === id)
  if (!score) throw new Error(`no score for player ${id}`)
  return score
}

describe('the scoring table', () => {
  it('matches docs/scope.md', () => {
    expect(POINTS).toEqual({
      completedUndetected: 5,
      completedDetected: 1,
      notCompleted: 0,
      correctAccusation: 2,
      wrongAccusation: -1,
    })
  })

  it('gives +5 for completed and not detected', () => {
    const s = scoreOf(scoreGame([player(1, 'Alice', true), player(2, 'Bob', false)], []), 1)
    expect(s).toMatchObject({ detected: false, challengePoints: 5, accusationPoints: 0, total: 5 })
  })

  it('gives +1 for completed but detected', () => {
    const players = [player(1, 'Alice', true), player(2, 'Bob', false)]
    const s = scoreOf(scoreGame(players, [guess(2, 1, 1)]), 1)
    expect(s).toMatchObject({ detected: true, challengePoints: 1, total: 1 })
  })

  it('gives 0 for not completed, detected or not', () => {
    const players = [player(1, 'Alice', false), player(2, 'Bob', false), player(3, 'Cara', false)]
    const scores = scoreGame(players, [guess(3, 1, 1)])
    expect(scoreOf(scores, 1)).toMatchObject({ detected: true, challengePoints: 0 })
    expect(scoreOf(scores, 2)).toMatchObject({ detected: false, challengePoints: 0 })
  })

  it('gives +2 for each correct accusation', () => {
    const players = [player(1, 'Alice', false), player(2, 'Bob', false), player(3, 'Cara', false)]
    const s = scoreOf(scoreGame(players, [guess(1, 2, 2), guess(1, 3, 3)]), 1)
    expect(s).toMatchObject({ accusationPoints: 4, total: 4 })
    expect(s.correctAccusations).toHaveLength(2)
    expect(s.wrongAccusations).toHaveLength(0)
  })

  it('gives -1 for each wrong accusation, and totals can go below zero', () => {
    const players = [player(1, 'Alice', false), player(2, 'Bob', false), player(3, 'Cara', false)]
    const s = scoreOf(scoreGame(players, [guess(1, 2, 5), guess(1, 3, 2)]), 1)
    expect(s).toMatchObject({ accusationPoints: -2, total: -2 })
    expect(s.wrongAccusations).toHaveLength(2)
  })

  it('adds challenge and accusation points together', () => {
    const players = [player(1, 'Alice', true), player(2, 'Bob', false), player(3, 'Cara', false)]
    const s = scoreOf(scoreGame(players, [guess(1, 2, 2), guess(1, 3, 9)]), 1)
    expect(s).toMatchObject({ challengePoints: 5, accusationPoints: 1, total: 6 })
  })

  it('gives nothing for the decoy', () => {
    // Bob guesses Alice's decoy, not her challenge: wrong, and she stays undetected.
    const alice = player(1, 'Alice', true)
    const s = scoreGame([alice, player(2, 'Bob', false)], [guess(2, 1, alice.decoy!)])
    expect(scoreOf(s, 1)).toMatchObject({ detected: false, total: 5 })
    expect(scoreOf(s, 2)).toMatchObject({ total: -1 })
  })
})

describe('detection', () => {
  const players = [
    player(1, 'Alice', true),
    player(2, 'Bob', true),
    player(3, 'Cara', true),
    player(4, 'Dev', true),
  ]

  it('counts a player as detected when one other player guesses right', () => {
    const detectedBy = detect(players, [guess(2, 1, 1), guess(3, 1, 7)])
    expect(detectedBy.get(1)).toEqual([2])
    expect(scoreOf(scoreGame(players, [guess(2, 1, 1), guess(3, 1, 7)]), 1).detectedBy).toEqual([
      { id: 2, name: 'Bob' },
    ])
  })

  it('counts several correct guesses the same as one', () => {
    const accusations = [guess(2, 1, 1), guess(3, 1, 1), guess(4, 1, 1)]
    expect(detect(players, accusations).get(1)).toEqual([2, 3, 4])
    const s = scoreOf(scoreGame(players, accusations), 1)
    expect(s).toMatchObject({ detected: true, challengePoints: 1, total: 1 })
  })

  it('detects nobody when every guess is wrong', () => {
    const accusations = [guess(1, 2, 1), guess(2, 3, 4), guess(3, 4, 3), guess(4, 1, 2)]
    const scores = scoreGame(players, accusations)
    for (const s of scores) {
      expect(s).toMatchObject({ detected: false, detectedBy: [], challengePoints: 5, total: 4 })
    }
  })

  it('detects everyone when everyone is guessed right', () => {
    const accusations = [guess(1, 2, 2), guess(2, 3, 3), guess(3, 4, 4), guess(4, 1, 1)]
    const scores = scoreGame(players, accusations)
    for (const s of scores) {
      expect(s).toMatchObject({ detected: true, challengePoints: 1, accusationPoints: 2, total: 3 })
    }
  })

  it('handles players who made no accusations and a game with none at all', () => {
    const scores = scoreGame(players, [guess(1, 2, 2)])
    expect(scoreOf(scores, 3)).toMatchObject({
      correctAccusations: [],
      wrongAccusations: [],
      accusationPoints: 0,
      total: 5,
    })
    const none = scoreGame(players, [])
    expect(none.every((s) => s.total === 5 && s.rank === 1)).toBe(true)
  })

  it('ignores self-accusations and accusations by or about removed players', () => {
    // Player 9 was removed by the host, so isn't in the player list.
    const accusations = [guess(1, 1, 1), guess(9, 2, 2), guess(3, 9, 9)]
    const scores = scoreGame(players, accusations)
    expect(scoreOf(scores, 1)).toMatchObject({ detected: false, total: 5 })
    expect(scoreOf(scores, 2)).toMatchObject({ detected: false, total: 5 })
    expect(scoreOf(scores, 3)).toMatchObject({ wrongAccusations: [], total: 5 })
    expect([...detect(players, accusations).values()]).toEqual([[], [], [], []])
  })

  it('counts only the last of two guesses by one player about the same player', () => {
    const scores = scoreGame(players, [guess(1, 2, 2), guess(1, 2, 3)])
    expect(scoreOf(scores, 1)).toMatchObject({ correctAccusations: [], accusationPoints: -1 })
    expect(scoreOf(scores, 1).wrongAccusations).toHaveLength(1)
    expect(scoreOf(scores, 2)).toMatchObject({ detected: false })
    expect(detect(players, [guess(1, 2, 3), guess(1, 2, 2)]).get(2)).toEqual([1])
  })

  it('ignores guesses that are not a challenge number', () => {
    const accusations = [guess(1, 2, 0), guess(1, 3, 21), guess(1, 4, Number.NaN), guess(2, 3, 2.5)]
    const scores = scoreGame(players, accusations)
    expect(scoreOf(scores, 1)).toMatchObject({ wrongAccusations: [], total: 5 })
    expect(scoreOf(scores, 2)).toMatchObject({ wrongAccusations: [], total: 5 })
  })

  it('lists detectors in a fixed order, whatever order the guesses come in', () => {
    const accusations = [guess(4, 1, 1), guess(2, 1, 1), guess(3, 1, 1)]
    expect(detect(players, accusations).get(1)).toEqual([2, 3, 4])
    expect(scoreOf(scoreGame(players, accusations), 1).detectedBy.map((d) => d.name)).toEqual([
      'Bob',
      'Cara',
      'Dev',
    ])
  })

  it('judges each player on their own challenge when challenges are shared (over 20 players)', () => {
    // Alice and Bob both have challenge 3. A right guess about Alice doesn't detect Bob.
    const shared = [
      player(1, 'Alice', true, 3),
      player(2, 'Bob', true, 3),
      player(3, 'Cara', false, 7),
    ]
    const scores = scoreGame(shared, [guess(3, 1, 3), guess(1, 2, 3)])
    expect(scoreOf(scores, 1)).toMatchObject({ detected: true, challengePoints: 1, total: 3 })
    expect(scoreOf(scores, 2)).toMatchObject({ detected: true, detectedBy: [{ id: 1, name: 'Alice' }] })
    expect(scoreGame(shared, [guess(3, 1, 3)]).find((s) => s.id === 2)).toMatchObject({
      detected: false,
      total: 5,
    })
  })

  it('scores a player listed twice only once', () => {
    const scores = scoreGame([player(1, 'Alice', true), player(1, 'Alice', true), player(2, 'Bob', false)], [])
    expect(scores.map((s) => [s.name, s.rank])).toEqual([
      ['Alice', 1],
      ['Bob', 2],
    ])
  })
})

// A player who never got a challenge and decoy (unit 3.05).
function unassigned(id: number, name: string, completed = false): ScoringPlayer {
  return { id, name, challenge: null, decoy: null, completed }
}

describe('a player with no challenge', () => {
  it('scores no challenge points, even if marked completed', () => {
    const s = scoreOf(scoreGame([unassigned(1, 'Alice', true), player(2, 'Bob', false)], []), 1)
    expect(s).toMatchObject({ challenge: null, decoy: null, challengePoints: 0, detected: false, total: 0 })
  })

  it('ignores guesses about them, which neither score nor cost a point', () => {
    const players = [unassigned(1, 'Alice'), player(2, 'Bob', false), player(3, 'Cara', false)]
    const scores = scoreGame(players, [guess(2, 1, 1), guess(3, 1, 5)])
    expect(scoreOf(scores, 1)).toMatchObject({ detected: false, detectedBy: [] })
    expect(scoreOf(scores, 2)).toMatchObject({ correctAccusations: [], wrongAccusations: [], total: 0 })
    expect(scoreOf(scores, 3)).toMatchObject({ correctAccusations: [], wrongAccusations: [], total: 0 })
    expect(detect(players, [guess(2, 1, 1)]).get(1)).toEqual([])
  })

  it('scores their own guesses and ranks them with everyone else', () => {
    const players = [unassigned(1, 'Alice'), player(2, 'Bob', true), player(3, 'Cara', false)]
    // Alice guesses Bob right (+2) and Cara wrong (-1), so Bob is detected (+1).
    const scores = scoreGame(players, [guess(1, 2, 2), guess(1, 3, 4)])
    expect(scores.map((s) => [s.name, s.total, s.rank])).toEqual([
      ['Alice', 1, 1],
      ['Bob', 1, 1],
      ['Cara', 0, 3],
    ])
    expect(scoreOf(scores, 2).detectedBy).toEqual([{ id: 1, name: 'Alice' }])
  })
})

describe('the leaderboard', () => {
  it('lists the highest total first', () => {
    const players = [player(1, 'Alice', false), player(2, 'Bob', true), player(3, 'Cara', false)]
    const scores = scoreGame(players, [guess(3, 1, 1)])
    expect(scores.map((s) => [s.name, s.total, s.rank])).toEqual([
      ['Bob', 5, 1],
      ['Cara', 2, 2],
      ['Alice', 0, 3],
    ])
  })

  it('gives tied players the same rank and skips the next one', () => {
    const players = [
      player(1, 'dev', true),
      player(2, 'Cara', true),
      player(3, 'Bob', false),
      player(4, 'alice', false),
      player(5, 'Eve', false),
    ]
    // Eve guesses Bob right (+2); Alice guesses wrong (-1).
    const scores = scoreGame(players, [guess(5, 3, 3), guess(4, 1, 2)])
    expect(scores.map((s) => [s.name, s.total, s.rank])).toEqual([
      ['Cara', 5, 1],
      ['dev', 5, 1],
      ['Eve', 2, 3],
      ['Bob', 0, 4],
      ['alice', -1, 5],
    ])
  })

  it('orders tied players by name ignoring capitals', () => {
    const scores = scoreGame([player(1, 'Bob', false), player(2, 'alice', false)], [])
    expect(scores.map((s) => s.name)).toEqual(['alice', 'Bob'])
  })

  it('shares rank 1 when everyone ties', () => {
    const scores = scoreGame([player(1, 'Alice', false), player(2, 'Bob', false)], [])
    expect(scores.map((s) => s.rank)).toEqual([1, 1])
  })

  it('handles an empty game', () => {
    expect(scoreGame([], [])).toEqual([])
  })
})

// A full game of five worked out by hand from the table in docs/scope.md.
//
// Challenges: Alice 1, Bob 2, Cara 3, Dev 4, Eve 5. Everyone but Cara completed.
// Final guesses:
//   Alice: Bob 2 (right), Cara 4 (wrong), Dev 4 (right)
//   Bob:   Alice 3 (wrong), Dev 4 (right)
//   Cara:  Alice 1 (right), Eve 2 (wrong)
//   Dev:   none
//   Eve:   Cara 3 (right), Bob 1 (wrong)
// Detected: Alice (by Cara), Bob (by Alice), Cara (by Eve), Dev (by Alice and Bob).
// Eve is not detected.
//
//          challenge          accusations        total
//   Alice  done, detected +1  2 right, 1 wrong +3   4
//   Bob    done, detected +1  1 right, 1 wrong +1   2
//   Cara   not done        0  1 right, 1 wrong +1   1
//   Dev    done, detected +1  none             0    1
//   Eve    done, hidden   +5  1 right, 1 wrong +1   6
//
// Leaderboard: Eve 6 (1st), Alice 4 (2nd), Bob 2 (3rd), Cara 1 and Dev 1 (4th).
describe('a full game worked out by hand', () => {
  const players = [
    player(1, 'Alice', true),
    player(2, 'Bob', true),
    player(3, 'Cara', false),
    player(4, 'Dev', true),
    player(5, 'Eve', true),
  ]
  const accusations = [
    guess(1, 2, 2),
    guess(1, 3, 4),
    guess(1, 4, 4),
    guess(2, 1, 3),
    guess(2, 4, 4),
    guess(3, 1, 1),
    guess(3, 5, 2),
    guess(5, 3, 3),
    guess(5, 2, 1),
  ]
  const scores = scoreGame(players, accusations)

  it('ranks the leaderboard', () => {
    expect(scores.map((s) => [s.name, s.challengePoints, s.accusationPoints, s.total, s.rank])).toEqual([
      ['Eve', 5, 1, 6, 1],
      ['Alice', 1, 3, 4, 2],
      ['Bob', 1, 1, 2, 3],
      ['Cara', 0, 1, 1, 4],
      ['Dev', 1, 0, 1, 4],
    ])
  })

  it("gives each player's breakdown for the reveal", () => {
    expect(scoreOf(scores, 1)).toEqual({
      id: 1,
      name: 'Alice',
      challenge: 1,
      decoy: 20,
      completed: true,
      detected: true,
      detectedBy: [{ id: 3, name: 'Cara' }],
      correctAccusations: [
        { accusedId: 2, accusedName: 'Bob', guessed: 2, actual: 2 },
        { accusedId: 4, accusedName: 'Dev', guessed: 4, actual: 4 },
      ],
      wrongAccusations: [{ accusedId: 3, accusedName: 'Cara', guessed: 4, actual: 3 }],
      challengePoints: 1,
      accusationPoints: 3,
      total: 4,
      rank: 2,
    })
    expect(scoreOf(scores, 4).detectedBy.map((d) => d.name)).toEqual(['Alice', 'Bob'])
    expect(scoreOf(scores, 5)).toMatchObject({ detected: false, detectedBy: [] })
    expect(scoreOf(scores, 3)).toMatchObject({ completed: false, detected: true })
  })
})

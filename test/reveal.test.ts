import { env } from 'cloudflare:test'
import { exports } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { generateSignedCookie } from 'hono/cookie'
import { beforeEach, describe, expect, it } from 'vitest'
import { hashPin } from '../src/auth/pin'
import { createDb } from '../src/db/client'
import { accusations, game, type Player, players } from '../src/db/schema'
import { nameKey } from '../src/game/names'
import type { Phase } from '../src/game/phases'
import { resetDb } from './reset-db'

const db = createDb(env.DB)
const BASE = 'https://example.com'

beforeEach(resetDb)

const setPhase = (phase: Phase) => db.update(game).set({ phase })

const addPlayer = async (
  name: string,
  assigned?: { challenge: number; decoy: number; completed?: boolean },
): Promise<Player> => {
  const [player] = await db
    .insert(players)
    .values({ name, nameKey: nameKey(name), ...(await hashPin('0000')), ...assigned })
    .returning()
  if (!player) throw new Error('insert returned nothing')
  return player
}

// The signed cookie a phone logged in as `player` holds (unit 3.01).
const cookieFor = async (player: Player) =>
  (
    await generateSignedCookie(
      'player',
      `${player.id}.${Math.floor(player.joinedAt.getTime() / 1000)}`,
      env.COOKIE_SECRET,
    )
  ).split(';')[0]!

const getReveal = (cookie?: string, headers: Record<string, string> = {}) =>
  exports.default.fetch(`${BASE}/reveal`, {
    headers: { ...(cookie && { Cookie: cookie }), ...headers },
    redirect: 'manual',
  })

const guess = (accuser: Player, accused: Player, challenge: number) =>
  db.insert(accusations).values({ accuserId: accuser.id, accusedId: accused.id, challenge })

// The text of one player's breakdown: from their <details> to the next.
const breakdownOf = (html: string, player: Player) => {
  const start = html.indexOf(`<details id="player-${player.id}"`)
  if (start < 0) throw new Error(`no breakdown for ${player.name}`)
  const end = html.indexOf('</details>', start)
  return html.slice(start, end)
}

// The leaderboard's rows as [rank, name, points], with tags stripped.
const leaderboardRows = (html: string) => {
  const tbody = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'))
  return [...tbody.matchAll(/<tr[^>]*>(.*?)<\/tr>/g)].map((row) =>
    [...row[1]!.matchAll(/<td>(.*?)<\/td>/g)].map((cell) => cell[1]!.replace(/<[^>]+>/g, '')),
  )
}

describe('before the reveal', () => {
  it('sends a phone that is not logged in to the join page', async () => {
    await setPhase('reveal')
    const res = await getReveal()
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/')
  })

  for (const phase of ['lobby', 'game_on', 'accusations_closed'] as const) {
    it(`sends the phone back to the player screen and shows nothing in ${phase}`, async () => {
      const alice = await addPlayer('Alice', { challenge: 1, decoy: 11, completed: true })
      const bob = await addPlayer('Bob', { challenge: 2, decoy: 12 })
      await guess(alice, bob, 2)
      await setPhase(phase)
      const cookie = await cookieFor(alice)

      const res = await getReveal(cookie)
      expect(res.status).toBe(303)
      expect(res.headers.get('Location')).toBe('/play')
      const body = await res.text()
      for (const secret of ['Bob', 'Challenge', 'Decoy', 'Description', 'points']) {
        expect(body).not.toContain(secret)
      }

      const htmx = await getReveal(cookie, { 'HX-Request': 'true' })
      expect(htmx.status).toBe(200)
      expect(htmx.headers.get('HX-Redirect')).toBe('/play')
      expect(await htmx.text()).toBe('')
    })
  }
})

// A full game of five worked out by hand from the table in docs/scope.md,
// separately from unit 2.01's own example.
//
// Challenge and decoy: Alice 1 and 11, Bob 2 and 12, Cara 3 and 13, Dev 4 and
// 14, Eve 5 and 15. Everyone but Cara completed.
// Final guesses:
//   Alice: Bob 2 (right), Cara 13 (wrong; Cara's decoy number, not her challenge)
//   Bob:   Alice 1 (right), Eve 4 (wrong)
//   Cara:  Bob 2 (right), Dev 4 (right)
//   Dev:   none
//   Eve:   Cara 5 (wrong)
// Detected: Alice (by Bob), Bob (by Alice and Cara), Dev (by Cara). Cara and
// Eve are not detected.
//
//          challenge          accusations          total
//   Alice  done, detected +1  1 right, 1 wrong +1    2
//   Bob    done, detected +1  1 right, 1 wrong +1    2
//   Cara   not done        0  2 right         +4    4
//   Dev    done, detected +1  none             0    1
//   Eve    done, hidden   +5  1 wrong         -1    4
//
// Leaderboard: Cara 4 and Eve 4 (=1), Alice 2 and Bob 2 (=3), Dev 1 (5).
describe('a full game worked out by hand', () => {
  const setUp = async () => {
    const alice = await addPlayer('Alice', { challenge: 1, decoy: 11, completed: true })
    const bob = await addPlayer('Bob', { challenge: 2, decoy: 12, completed: true })
    const cara = await addPlayer('Cara', { challenge: 3, decoy: 13 })
    const dev = await addPlayer('Dev', { challenge: 4, decoy: 14, completed: true })
    const eve = await addPlayer('Eve', { challenge: 5, decoy: 15, completed: true })
    await guess(alice, bob, 2)
    await guess(alice, cara, 13)
    await guess(bob, alice, 1)
    await guess(bob, eve, 4)
    await guess(cara, bob, 2)
    await guess(cara, dev, 4)
    await guess(eve, cara, 5)
    await setPhase('reveal')
    return { alice, bob, cara, dev, eve }
  }

  it('shows the leaderboard with shared ranks and the phone marked as you', async () => {
    const { dev } = await setUp()
    const res = await getReveal(await cookieFor(dev))
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('<title>Final results</title>')
    expect(leaderboardRows(html)).toEqual([
      ['=1', 'Cara', '4'],
      ['=1', 'Eve', '4'],
      ['=3', 'Alice', '2'],
      ['=3', 'Bob', '2'],
      ['5', 'Dev (you)', '1'],
    ])
    expect(html.match(/aria-current="true"/g)).toHaveLength(1)
  })

  it("gives one player's full breakdown", async () => {
    const { alice, bob } = await setUp()
    const html = await (await getReveal(await cookieFor(alice))).text()
    const text = breakdownOf(html, bob).replace(/<[^>]+>/g, '')
    expect(text).toContain('=3. Bob: 2 points')
    expect(text).toContain('Challenge 2Description of Challenge 2')
    expect(text).toContain('Decoy 12Description of Decoy 12')
    expect(text).toContain('Completed: Yes')
    expect(text).toContain('Detected by: Alice, Cara')
    expect(text).toContain('Challenge points: +1 (completed but detected)')
    expect(text).toContain('Right (+2)')
    expect(text).toContain('Alice: Challenge 1 (+2)')
    expect(text).toContain('Wrong (−1)')
    expect(text).toContain('Eve: guessed Challenge 4, it was Challenge 5 (−1)')
    expect(text).toContain('Total: 2 points')
  })

  it('explains each challenge result', async () => {
    const { alice, cara, dev, eve } = await setUp()
    const html = await (await getReveal(await cookieFor(alice))).text()
    const text = (p: Player) => breakdownOf(html, p).replace(/<[^>]+>/g, '')
    expect(text(cara)).toContain('Completed: No')
    expect(text(cara)).toContain('Detected by: Nobody')
    expect(text(cara)).toContain('Challenge points: 0 (not completed)')
    expect(text(cara)).toContain('Right (+4)')
    expect(text(cara)).toContain('Wrong (0)None.')
    expect(text(dev)).toContain('Right (0)None.')
    expect(text(eve)).toContain('Challenge points: +5 (completed and not detected)')
    expect(text(eve)).toContain('Cara: guessed Challenge 5, it was Challenge 3 (−1)')
    expect(text(eve)).toContain('Total: 4 points')
    expect(text(dev)).toMatch(/Total: 1 point$/)
  })

  it("opens only the phone's own breakdown", async () => {
    const { bob, eve } = await setUp()
    const html = await (await getReveal(await cookieFor(eve))).text()
    expect(html.match(/<details id="player-\d+" open/g)).toEqual([`<details id="player-${eve.id}" open`])
    expect(breakdownOf(html, bob)).not.toContain(' open')
  })

  it('shows every player the same scores', async () => {
    const all = await setUp()
    const boards = await Promise.all(
      Object.values(all).map(async (p) =>
        leaderboardRows(await (await getReveal(await cookieFor(p))).text()).map(([rank, name, total]) => [
          rank,
          name!.replace(' (you)', ''),
          total,
        ]),
      ),
    )
    for (const board of boards) expect(board).toEqual(boards[0])
  })
})

describe('awkward games', () => {
  it('shows a player who never got a challenge, and ignores guesses about them', async () => {
    const alice = await addPlayer('Alice', { challenge: 1, decoy: 11, completed: true })
    const late = await addPlayer('Late')
    await guess(alice, late, 3)
    await setPhase('reveal')
    const html = await (await getReveal(await cookieFor(late))).text()
    expect(leaderboardRows(html)).toEqual([
      ['1', 'Alice', '5'],
      ['2', 'Late (you)', '0'],
    ])
    const text = breakdownOf(html, late).replace(/<[^>]+>/g, '')
    expect(text).toContain('Never got a challenge.')
    expect(text).toContain('Never got a decoy.')
    expect(text).toContain('Challenge points: 0 (never got a challenge)')
    expect(text).not.toContain('Completed:')
    expect(breakdownOf(html, alice).replace(/<[^>]+>/g, '')).toContain('Wrong (0)None.')
  })

  it('handles a game with no accusations', async () => {
    const alice = await addPlayer('Alice', { challenge: 1, decoy: 11, completed: true })
    await addPlayer('Bob', { challenge: 2, decoy: 12 })
    await setPhase('reveal')
    const html = await (await getReveal(await cookieFor(alice))).text()
    expect(leaderboardRows(html)).toEqual([
      ['1', 'Alice (you)', '5'],
      ['2', 'Bob', '0'],
    ])
  })

  it("drops a removed player and their guesses from everyone's scores", async () => {
    const alice = await addPlayer('Alice', { challenge: 1, decoy: 11, completed: true })
    const bob = await addPlayer('Bob', { challenge: 2, decoy: 12 })
    const gone = await addPlayer('Gone', { challenge: 3, decoy: 13 })
    await guess(gone, alice, 1)
    await guess(bob, gone, 3)
    await db.delete(players).where(eq(players.id, gone.id))
    await setPhase('reveal')
    const html = await (await getReveal(await cookieFor(bob))).text()
    expect(html).not.toContain('Gone')
    expect(leaderboardRows(html)).toEqual([
      ['1', 'Alice', '5'],
      ['2', 'Bob (you)', '0'],
    ])
  })

  it('escapes names', async () => {
    const alice = await addPlayer('<b>Alice</b>', { challenge: 1, decoy: 11 })
    await setPhase('reveal')
    const html = await (await getReveal(await cookieFor(alice))).text()
    expect(html).not.toContain('<b>Alice</b>')
    expect(html).toContain('&lt;b&gt;Alice&lt;/b&gt;')
  })
})

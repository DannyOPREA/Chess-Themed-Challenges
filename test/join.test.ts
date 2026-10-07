import { env } from 'cloudflare:test'
import { exports } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { generateSignedCookie } from 'hono/cookie'
import { beforeEach, describe, expect, it } from 'vitest'
import { hashPin, verifyPin } from '../src/auth/pin'
import { createDb } from '../src/db/client'
import { accusations, game, players } from '../src/db/schema'
import { nameKey } from '../src/game/names'
import type { Phase } from '../src/game/phases'
import { resetDb } from './reset-db'

const db = createDb(env.DB)
const BASE = 'https://example.com'

beforeEach(resetDb)

const setPhase = (phase: Phase) => db.update(game).set({ phase })

const addPlayer = async (name: string, pin = '0000', assigned?: { challenge: number; decoy: number }) => {
  const [player] = await db
    .insert(players)
    .values({ name, nameKey: nameKey(name), ...(await hashPin(pin)), ...assigned })
    .returning()
  if (!player) throw new Error('insert returned nothing')
  return player
}

const allPlayers = () => db.select().from(players)

const join = (name: string, pin: string) =>
  exports.default.fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE },
    body: new URLSearchParams({ name, pin }).toString(),
    redirect: 'manual',
  })

const get = (path: string, cookie?: string, headers: Record<string, string> = {}) =>
  exports.default.fetch(`${BASE}${path}`, {
    headers: { ...(cookie && { Cookie: cookie }), ...headers },
    redirect: 'manual',
  })

// The `name=value` part of the player cookie a response sets.
const cookieFrom = (res: Response): string | undefined =>
  res.headers
    .getSetCookie()
    .find((c) => c.startsWith('player='))
    ?.split(';')[0]

// Joins and returns the cookie, failing the test if the join was refused.
const joinedCookie = async (name: string, pin: string) => {
  const res = await join(name, pin)
  expect(res.status).toBe(303)
  const cookie = cookieFrom(res)
  if (!cookie) throw new Error('no player cookie was set')
  return cookie
}

const NAME_TAKEN = 'That name is already taken'
const GAME_CLOSED = 'Nobody has joined with that name, and new players can no longer join.'

describe('the join page', () => {
  it('asks for a name and a 4-digit PIN', async () => {
    const res = await get('/')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Join the game')
    expect(html).toContain('<form method="post" action="/">')
    expect(html).toContain('name="name"')
    expect(html).toMatch(/name="pin" type="password" inputmode="numeric" pattern="\[0-9\]\{4\}"/)
  })

  it('offers only getting back in once accusations close', async () => {
    for (const phase of ['accusations_closed', 'reveal'] as const) {
      await setPhase(phase)
      const html = await (await get('/')).text()
      expect(html).not.toContain('Join the game')
      expect(html).toContain('Get back in')
    }
  })
})

describe('joining', () => {
  it('adds the player with a salted PIN hash, remembers the phone and goes to the player screen', async () => {
    const res = await join('Sam', '1234')
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/play')
    const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('player='))
    expect(setCookie).toMatch(/HttpOnly/)
    expect(setCookie).toMatch(/Secure/)
    expect(setCookie).toMatch(/SameSite=Lax/)
    expect(setCookie).toMatch(/Path=\//)

    const [player, ...others] = await allPlayers()
    expect(others).toEqual([])
    expect(player?.name).toBe('Sam')
    expect(player?.pinHash).toMatch(/^[0-9a-f]{64}$/)
    expect(player?.pinSalt).toMatch(/^[0-9a-f]{32}$/)
    expect(player?.pinHash).not.toContain('1234')
    expect(await verifyPin('1234', player!)).toBe(true)

    const cookie = cookieFrom(res)
    const play = await get('/play', cookie)
    expect(play.status).toBe(200)
    expect(await play.text()).toContain('<h1>Sam</h1>')
  })

  it('sends a phone that is already in straight to the player screen', async () => {
    const cookie = await joinedCookie('Sam', '1234')
    const res = await get('/', cookie)
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/play')
  })

  it('stores and shows the name without spaces at either end or repeated spaces', async () => {
    const cookie = await joinedCookie('   Sam    Smith  ', '1234')
    const [player] = await allPlayers()
    expect(player?.name).toBe('Sam Smith')
    expect(player?.nameKey).toBe('sam smith')
    expect(await (await get('/play', cookie)).text()).toContain('<h1>Sam Smith</h1>')
  })

  it('refuses a name already taken in different capitals or spacing, unless the PIN matches', async () => {
    await joinedCookie('Sam', '1234')
    for (const name of ['sam', 'SAM', ' sAm ']) {
      const res = await join(name, '5678')
      expect(res.status).toBe(400)
      expect(await res.text()).toContain(NAME_TAKEN)
      expect(cookieFrom(res)).toBeUndefined()
    }
    expect(await allPlayers()).toHaveLength(1)
  })

  it('refuses a wrong PIN for an existing name, and lets the right one in', async () => {
    const sam = await addPlayer('Sam', '1234')
    const wrong = await join('Sam', '4321')
    expect(wrong.status).toBe(400)
    expect(await wrong.text()).toContain(NAME_TAKEN)
    expect(cookieFrom(wrong)).toBeUndefined()

    const cookie = await joinedCookie('Sam', '1234')
    expect(await allPlayers()).toHaveLength(1)
    expect(await (await get('/play', cookie)).text()).toContain('<h1>Sam</h1>')
    expect((await allPlayers())[0]?.id).toBe(sam.id)
  })

  it.each([
    ['a 3-digit PIN', 'Sam', '123', 'The PIN must be 4 digits'],
    ['a 5-digit PIN', 'Sam', '12345', 'The PIN must be 4 digits'],
    ['letters in the PIN', 'Sam', 'abcd', 'The PIN must be 4 digits'],
    ['no PIN', 'Sam', '', 'The PIN must be 4 digits'],
    ['no name', '', '1234', 'Enter your name.'],
    ['a name of only spaces', '    ', '1234', 'Enter your name.'],
    ['a name over 30 characters', 'x'.repeat(31), '1234', 'Keep your name to 30 characters or fewer.'],
  ])('refuses %s, keeping the name typed but not the PIN', async (_, name, pin, message) => {
    const res = await join(name, pin)
    expect(res.status).toBe(400)
    const html = await res.text()
    expect(html).toContain(message)
    expect(html).toContain('<form method="post" action="/">')
    if (pin) expect(html).not.toContain(`value="${pin}"`)
    expect(await allPlayers()).toEqual([])
  })

  it('refuses a form with no fields at all, in plain words', async () => {
    const res = await exports.default.fetch(`${BASE}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE },
      body: '',
    })
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Enter your name.')
    expect(await allPlayers()).toEqual([])
  })

  it('refuses a missing PIN in plain words', async () => {
    const res = await exports.default.fetch(`${BASE}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE },
      body: 'name=Sam',
    })
    expect(res.status).toBe(400)
    expect(await res.text()).toContain('The PIN must be 4 digits')
  })

  it('drops invisible characters from names, so a name cannot look blank or like someone else', async () => {
    const blank = await join('\u200B\u200D\u2060', '1234')
    expect(blank.status).toBe(400)
    expect(await blank.text()).toContain('Enter your name.')
    await joinedCookie('Sam\u200B Smith', '1234')
    expect((await allPlayers())[0]?.name).toBe('Sam Smith')
    const lookalike = await join('Sam Smith\u200B', '5678')
    expect(await lookalike.text()).toContain(NAME_TAKEN)
    expect(await allPlayers()).toHaveLength(1)
  })

  it('keeps emoji made of several joined parts whole', async () => {
    await joinedCookie('Coder \u{1F469}\u200D\u{1F4BB}', '1234')
    expect((await allPlayers())[0]?.name).toBe('Coder \u{1F469}\u200D\u{1F4BB}')
    await joinedCookie('Tone \u{1F469}\u{1F3FD}\u200D\u{1F4BB}', '1234')
    expect((await allPlayers())[1]?.name).toBe('Tone \u{1F469}\u{1F3FD}\u200D\u{1F4BB}')
    expect((await join('Al\u200Dex', '1234')).status).toBe(303)
    expect((await allPlayers()).map((p) => p.name)).toContain('Alex')
  })

  it('leaves Secure off the cookie only on plain http, for the local dev server', async () => {
    const res = await exports.default.fetch('http://localhost:8787/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'http://localhost:8787' },
      body: new URLSearchParams({ name: 'Sam', pin: '1234' }).toString(),
      redirect: 'manual',
    })
    expect(res.status).toBe(303)
    const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('player='))
    expect(setCookie).toMatch(/HttpOnly/)
    expect(setCookie).not.toMatch(/Secure/)
  })

  it('leaves players who join in the Lobby without a challenge until Game on', async () => {
    const cookie = await joinedCookie('Sam', '1234')
    const [player] = await allPlayers()
    expect(player?.challenge).toBeNull()
    expect(player?.decoy).toBeNull()
    expect(await (await get('/play', cookie)).text()).toContain('appear here when the game starts')
  })

  it('refuses new players once accusations close, but still lets players back in', async () => {
    await addPlayer('Sam', '1234', { challenge: 1, decoy: 1 })
    for (const phase of ['accusations_closed', 'reveal'] as const) {
      await setPhase(phase)
      const res = await join('Alex', '1234')
      expect(res.status).toBe(400)
      expect(await res.text()).toContain(GAME_CLOSED)
      expect(cookieFrom(res)).toBeUndefined()
      const wrong = await join('Sam', '9999')
      expect(await wrong.text()).toContain('That PIN doesn&#39;t match that name.')
      await joinedCookie('Sam', '1234')
    }
    expect((await allPlayers()).map((p) => p.name)).toEqual(['Sam'])
  })
})

describe('late joiners during Game on', () => {
  it('get an unused challenge and decoy straight away', async () => {
    await setPhase('game_on')
    for (let i = 1; i <= 5; i++) await addPlayer(`Player ${i}`, '0000', { challenge: i * 2, decoy: 21 - i })
    for (let i = 6; i <= 20; i++) await joinedCookie(`Late ${i}`, '1234')
    const everyone = await allPlayers()
    expect(everyone).toHaveLength(20)
    expect(new Set(everyone.map((p) => p.challenge)).size).toBe(20)
    expect(new Set(everyone.map((p) => p.decoy)).size).toBe(20)
  })

  it('get exactly the free challenge and decoy when 19 are taken', async () => {
    await setPhase('game_on')
    for (let i = 1; i <= 19; i++) {
      // Challenge 7 and decoy 12 are left free.
      await addPlayer(`Player ${i}`, '0000', { challenge: i < 7 ? i : i + 1, decoy: i < 12 ? i : i + 1 })
    }
    await joinedCookie('Late', '1234')
    const late = await db.select().from(players).where(eq(players.nameKey, 'late')).get()
    expect(late?.challenge).toBe(7)
    expect(late?.decoy).toBe(12)
  })

  it('all get different challenges when they join at the same moment', async () => {
    await setPhase('game_on')
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => join(`Racer ${i + 1}`, '1234')))
    expect(results.map((r) => r.status)).toEqual(new Array(20).fill(303))
    const everyone = await allPlayers()
    expect(new Set(everyone.map((p) => p.challenge)).size).toBe(20)
    expect(new Set(everyone.map((p) => p.decoy)).size).toBe(20)
  },
  // 20 racing joiners retry each other's clashes; about 0.3 s locally, but
  // over 5 s once on a busy CI runner, so it gets more than the default.
  30_000)

  it('assigns a player the host left unassigned when they next open a screen', async () => {
    // Joined in the Lobby just as the host started Game on, and was missed.
    const cookie = await joinedCookie('Sam', '1234')
    await addPlayer('Alex', '0000', { challenge: 1, decoy: 1 })
    await setPhase('game_on')
    const html = await (await get('/play', cookie)).text()
    const sam = await db.select().from(players).where(eq(players.nameKey, 'sam')).get()
    expect(sam?.challenge).not.toBeNull()
    expect(sam?.challenge).not.toBe(1)
    expect(sam?.decoy).not.toBe(1)
    expect(html).toContain(`<h3>Challenge ${sam?.challenge}</h3>`)
  })

  it('reuse challenges beyond 20 players instead of being refused', async () => {
    await setPhase('game_on')
    for (let i = 1; i <= 20; i++) await addPlayer(`Player ${i}`, '0000', { challenge: i, decoy: i })
    await joinedCookie('Number 21', '1234')
    const late = await db.select().from(players).where(eq(players.nameKey, 'number 21')).get()
    expect(late?.challenge).toBeGreaterThanOrEqual(1)
    expect(late?.decoy).toBeGreaterThanOrEqual(1)
  })
})

describe('rejoining', () => {
  it('from a new phone keeps the same challenge, decoy, completion and accusations', async () => {
    await setPhase('game_on')
    const sam = await addPlayer('Sam', '1234', { challenge: 3, decoy: 4 })
    const alex = await addPlayer('Alex', '0000', { challenge: 5, decoy: 6 })
    await db.update(players).set({ completed: true }).where(eq(players.id, sam.id))
    await db.insert(accusations).values({ accuserId: sam.id, accusedId: alex.id, challenge: 9 })
    const before = await allPlayers()

    const cookie = await joinedCookie('sam', '1234')
    expect(await allPlayers()).toEqual(before)
    expect(await db.select().from(accusations)).toEqual([
      { accuserId: sam.id, accusedId: alex.id, challenge: 9 },
    ])
    const html = await (await get('/play', cookie)).text()
    expect(html).toContain('<h1>Sam</h1>')
    expect(html).toContain('<h3>Challenge 3</h3>')
    expect(html).toContain('<h3>Decoy 4</h3>')
  })

  it('works in every phase', async () => {
    await addPlayer('Sam', '1234', { challenge: 3, decoy: 4 })
    for (const phase of ['lobby', 'game_on', 'accusations_closed', 'reveal'] as const) {
      await setPhase(phase)
      await joinedCookie('Sam', '1234')
    }
  })
})

describe('the player cookie', () => {
  it('shows a player only their own challenge and decoy', async () => {
    await setPhase('game_on')
    await addPlayer('Alex', '0000', { challenge: 2, decoy: 5 })
    await addPlayer('Sam', '1234', { challenge: 3, decoy: 4 })
    const html = await (await get('/play', await joinedCookie('Sam', '1234'))).text()
    expect(html).toMatch(/Description of Challenge 3\b/)
    expect(html).toMatch(/Decoy 4\b/)
    // Every challenge name is in the hint list (unit 3.02), but only the
    // player's own challenge has its description.
    expect(html).not.toMatch(/Description of Challenge 2\b/)
    expect(html).not.toMatch(/Decoy 5\b/)
    expect(html).not.toContain('Alex')
  })

  it('sends a phone that is not logged in back to the join page', async () => {
    const res = await get('/play')
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/')
  })

  it('tells htmx to load the join page as a whole page', async () => {
    const res = await get('/play', undefined, { 'HX-Request': 'true' })
    expect(res.status).toBe(200)
    expect(res.headers.get('HX-Redirect')).toBe('/')
    expect(await res.text()).toBe('')
  })

  it('logs out a phone whose player was removed', async () => {
    const cookie = await joinedCookie('Sam', '1234')
    await db.delete(players)
    const res = await get('/play', cookie)
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/')
    expect(res.headers.getSetCookie().find((c) => c.startsWith('player='))).toMatch(/Max-Age=0/)
    expect((await get('/', cookie)).status).toBe(200)
  })

  it('ignores a cookie that was changed on the phone', async () => {
    await joinedCookie('Alex', '0000')
    const cookie = await joinedCookie('Sam', '1234')
    const alex = (await allPlayers()).find((p) => p.name === 'Alex')!
    const forged = cookie.replace(/^player=\d+/, `player=${alex.id}`)
    expect((await get('/play', forged)).status).toBe(303)
  })

  it('ignores a correctly signed cookie from an earlier game', async () => {
    const sam = await addPlayer('Sam', '1234')
    const joined = Math.floor(sam.joinedAt.getTime() / 1000)
    const stale = await generateSignedCookie('player', `${sam.id}.${joined - 60}`, env.COOKIE_SECRET)
    expect((await get('/play', stale.split(';')[0])).status).toBe(303)
    const current = await generateSignedCookie('player', `${sam.id}.${joined}`, env.COOKIE_SECRET)
    expect((await get('/play', current.split(';')[0])).status).toBe(200)
  })

  it('is forgotten on "Not you? Log out", and the name and PIN still get back in', async () => {
    const cookie = await joinedCookie('Sam', '1234')
    const res = await exports.default.fetch(`${BASE}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE, Cookie: cookie },
      redirect: 'manual',
    })
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/')
    expect(res.headers.getSetCookie().find((c) => c.startsWith('player='))).toMatch(/Max-Age=0/)
    await joinedCookie('Sam', '1234')
    expect(await allPlayers()).toHaveLength(1)
  })
})

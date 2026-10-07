import { env } from 'cloudflare:test'
import { exports } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { verifyPin } from '../src/auth/pin'
import { createDb } from '../src/db/client'
import { getPhase } from '../src/db/game'
import { changePhase } from '../src/db/host'
import { accusations, game, players } from '../src/db/schema'
import type { Phase } from '../src/game/phases'
import { nameKey } from '../src/game/names'
import app from '../src/index'
import { resetDb } from './reset-db'

const db = createDb(env.DB)

beforeEach(resetDb)

const ORIGIN = 'https://example.com'
const auth = (password = 'test-host-password', user = 'host') => `Basic ${btoa(`${user}:${password}`)}`

const get = (path: string, headers: Record<string, string> = { Authorization: auth() }) =>
  exports.default.fetch(`${ORIGIN}${path}`, { headers, redirect: 'manual' })

const post = (path: string, form: Record<string, string> = {}, headers: Record<string, string> = {}) =>
  exports.default.fetch(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      Authorization: auth(),
      Origin: ORIGIN,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body: new URLSearchParams(form).toString(),
    redirect: 'manual',
  })

const addPlayer = async (name: string, assigned?: { challenge: number; decoy: number; completed?: boolean }) => {
  const [player] = await db
    .insert(players)
    .values({ name, nameKey: nameKey(name), pinHash: 'hash', pinSalt: 'salt', ...assigned })
    .returning()
  if (!player) throw new Error('insert returned nothing')
  return player
}

const setPhase = (phase: Phase) => db.update(game).set({ phase }).where(eq(game.id, 1))

const allPlayers = () => db.select().from(players).all()

// A seeded random source, so a failing assignment test repeats.
const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31
  return seed / 2 ** 31
}

describe('host login', () => {
  it('asks for the password', async () => {
    const res = await get('/host', {})
    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toContain('Basic')
  })

  it('refuses a wrong password', async () => {
    expect((await get('/host', { Authorization: auth('wrong') })).status).toBe(401)
  })

  it('accepts the password with any user name', async () => {
    expect((await get('/host', { Authorization: auth(undefined, 'host') })).status).toBe(200)
    expect((await get('/host', { Authorization: auth(undefined, 'danny') })).status).toBe(200)
  })

  it('protects every host path, including the fragments and actions', async () => {
    const player = await addPlayer('Player A')
    for (const path of ['/host/players', `/host/players/${player.id}`, '/host/qr', '/host/all', '/host/phase?to=game_on']) {
      expect((await get(path, {})).status, path).toBe(401)
    }
    expect((await post('/host/all', {}, { Authorization: auth('wrong') })).status).toBe(401)
    expect((await post(`/host/players/${player.id}/remove`, {}, { Authorization: '' })).status).toBe(401)
    expect(await allPlayers()).toHaveLength(1)
  })

  it('stays locked when no host password is set', async () => {
    const res = await app.request(`${ORIGIN}/host`, { headers: { Authorization: auth('') } }, {
      ...env,
      HOST_PASSWORD: '',
    })
    expect(res.status).toBe(401)
  })

  it('keeps host pages out of caches', async () => {
    expect((await get('/host')).headers.get('Cache-Control')).toBe('no-store')
  })

  it('refuses a host action posted from another site', async () => {
    const res = await post('/host/phase', { from: 'lobby', to: 'game_on' }, {
      Origin: 'https://other.example',
      'Sec-Fetch-Site': 'cross-site',
    })
    expect(res.status).toBe(403)
    expect(await getPhase(db)).toBe('lobby')
  })
})

describe('who has joined', () => {
  it('lists every player by name, polling every 10 seconds', async () => {
    await addPlayer('Player A')
    await addPlayer('Player <B>')
    const html = await (await get('/host')).text()
    expect(html).toContain('Players (2)')
    expect(html).toContain('Player A')
    expect(html).toContain('Player &lt;B&gt;')
    expect(html).toContain('hx-get="/host/players"')
    expect(html).toContain('hx-trigger="every 10s"')
  })

  it('serves the list on its own, without the layout, for the poll', async () => {
    await addPlayer('Player A')
    const html = await (await get('/host/players')).text()
    expect(html).toContain('Player A')
    expect(html).not.toContain('<html')
    expect(html).toContain('id="players"')
  })

  it('shows only its own notices', async () => {
    expect(await (await get('/host?done=removed')).text()).toContain('<article role="status"><strong>Player removed.</strong></article>')
    for (const done of ['constructor', 'toString', '<b>hi</b>']) {
      expect(await (await get(`/host?done=${encodeURIComponent(done)}`)).text()).not.toContain('role="status"')
    }
  })

  it('says when nobody has joined', async () => {
    expect(await (await get('/host')).text()).toContain('Nobody has joined yet.')
  })

  it('flags a player left without a challenge during the game', async () => {
    await setPhase('game_on')
    await addPlayer('Player A')
    expect(await (await get('/host')).text()).toContain('no challenge yet')
  })
})

describe('no spoilers on the host page', () => {
  // The test content set names challenges "Challenge n" and decoys "Decoy n".
  const secrets = /Challenge \d|Decoy \d|Description of|Marked done|Not marked done/

  it.each(['lobby', 'game_on', 'accusations_closed', 'reveal'] as const)(
    'shows no challenge, decoy or completion in the list in %s',
    async (phase) => {
      await setPhase(phase)
      await addPlayer('Player A', { challenge: 3, decoy: 7, completed: true })
      await addPlayer('Player B', { challenge: 4, decoy: 8 })
      for (const path of ['/host', '/host/players', '/host/qr', '/host/all']) {
        expect(await (await get(path)).text(), path).not.toMatch(secrets)
      }
    },
  )

  it("shows a player's completion on their own page, but not their challenge or decoy", async () => {
    await setPhase('game_on')
    const player = await addPlayer('Player A', { challenge: 3, decoy: 7, completed: true })
    const html = await (await get(`/host/players/${player.id}`)).text()
    expect(html).toContain('Marked done.')
    expect(html).not.toMatch(/Challenge \d|Decoy \d|Description of/)
  })
})

describe('changing the phase', () => {
  it('asks the host to confirm before changing anything', async () => {
    const res = await get('/host/phase?to=game_on')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('Move to Game on?')
    expect(html).toMatch(/This can(&#39;|')t be undone\./)
    expect(html).toContain('name="from" value="lobby"')
    expect(await getPhase(db)).toBe('lobby')
  })

  it('offers only the next phase', async () => {
    expect(await (await get('/host')).text()).toContain('href="/host/phase?to=game_on"')
    await setPhase('accusations_closed')
    expect(await (await get('/host')).text()).toContain('href="/host/phase?to=reveal"')
    await setPhase('reveal')
    const html = await (await get('/host')).text()
    expect(html).not.toContain('/host/phase?to=')
    expect(html).toContain('The game is over.')
  })

  it('moves forward through every phase once confirmed', async () => {
    for (const [from, to] of [
      ['lobby', 'game_on'],
      ['game_on', 'accusations_closed'],
      ['accusations_closed', 'reveal'],
    ] as const) {
      const res = await post('/host/phase', { from, to })
      expect(res.status).toBe(303)
      expect(res.headers.get('Location')).toBe('/host?done=phase')
      expect(await getPhase(db)).toBe(to)
    }
  })

  it('never skips a phase or goes back', async () => {
    for (const [from, to] of [
      ['lobby', 'accusations_closed'],
      ['lobby', 'reveal'],
      ['game_on', 'lobby'],
      ['game_on', 'reveal'],
    ] as const) {
      await setPhase(from)
      const res = await post('/host/phase', { from, to })
      expect(res.headers.get('Location')).toBe('/host?done=phase-unchanged')
      expect(await getPhase(db)).toBe(from)
    }
  })

  it('does nothing when the confirm page is stale (a double tap or a second tab)', async () => {
    await setPhase('game_on')
    const res = await post('/host/phase', { from: 'lobby', to: 'game_on' })
    expect(res.headers.get('Location')).toBe('/host?done=phase-unchanged')
    expect(await getPhase(db)).toBe('game_on')
    // The confirm page for a phase that has gone by sends the host back too.
    expect((await get('/host/phase?to=game_on')).headers.get('Location')).toBe('/host?done=phase-unchanged')
  })

  it('ignores a made-up phase', async () => {
    const res = await post('/host/phase', { from: 'lobby', to: 'finished' })
    expect(res.status).toBe(303)
    expect(await getPhase(db)).toBe('lobby')
    expect((await get('/host/phase?to=finished')).headers.get('Location')).toBe('/host')
  })
})

describe('starting Game on assigns the lobby', () => {
  it('gives every lobby player a different challenge and decoy', async () => {
    for (let i = 1; i <= 20; i++) await addPlayer(`Player ${i}`)
    await post('/host/phase', { from: 'lobby', to: 'game_on' })
    const all = await allPlayers()
    expect(new Set(all.map((p) => p.challenge)).size).toBe(20)
    expect(new Set(all.map((p) => p.decoy)).size).toBe(20)
    for (const p of all) {
      expect(p.challenge).toBeGreaterThanOrEqual(1)
      expect(p.challenge).toBeLessThanOrEqual(20)
      expect(p.decoy).toBeGreaterThanOrEqual(1)
      expect(p.decoy).toBeLessThanOrEqual(20)
    }
  })

  it('reuses numbers evenly beyond 20 players', async () => {
    for (let i = 1; i <= 22; i++) await addPlayer(`Player ${i}`)
    await changePhase(db, 'lobby', 'game_on', { random: seeded(1) })
    const counts = new Map<number, number>()
    for (const p of await allPlayers()) counts.set(p.challenge!, (counts.get(p.challenge!) ?? 0) + 1)
    expect(counts.size).toBe(20)
    expect(Math.max(...counts.values())).toBe(2)
  })

  it('keeps numbers a player already holds and gives no one else them', async () => {
    const held = await addPlayer('Player A', { challenge: 5, decoy: 9 })
    for (let i = 2; i <= 20; i++) await addPlayer(`Player ${i}`)
    await changePhase(db, 'lobby', 'game_on', { random: seeded(2) })
    const all = await allPlayers()
    expect(all.find((p) => p.id === held.id)).toMatchObject({ challenge: 5, decoy: 9 })
    expect(all.filter((p) => p.challenge === 5)).toHaveLength(1)
    expect(all.filter((p) => p.decoy === 9)).toHaveLength(1)
  })

  it('assigns nobody when the phase change is refused', async () => {
    await addPlayer('Player A')
    expect(await changePhase(db, 'lobby', 'accusations_closed')).toBe(false)
    expect((await allPlayers())[0]).toMatchObject({ challenge: null, decoy: null })
  })

  it('survives a double tap: one phase change, one set of numbers', async () => {
    for (let i = 1; i <= 20; i++) await addPlayer(`Player ${i}`)
    const results = await Promise.all([
      changePhase(db, 'lobby', 'game_on', { random: seeded(3) }),
      changePhase(db, 'lobby', 'game_on', { random: seeded(4) }),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await getPhase(db)).toBe('game_on')
    const all = await allPlayers()
    expect(new Set(all.map((p) => p.challenge)).size).toBe(20)
    expect(new Set(all.map((p) => p.decoy)).size).toBe(20)
  })

  it.each(['game_on', 'accusations_closed', 'reveal'] as const)(
    'assigns nobody from a stale Game on page once the game is in %s',
    async (phase) => {
      // As if a second run read the lobby before this player joined, and the
      // first run has since started the game.
      await setPhase(phase)
      await addPlayer('Player A')
      expect(await changePhase(db, 'lobby', 'game_on')).toBe(false)
      expect((await allPlayers())[0]).toMatchObject({ challenge: null, decoy: null })
      expect(await getPhase(db)).toBe(phase)
    },
  )

  it('starts the game with an empty lobby', async () => {
    expect(await changePhase(db, 'lobby', 'game_on')).toBe(true)
    expect(await getPhase(db)).toBe('game_on')
  })

  it('does not assign anyone on the other phase changes', async () => {
    await setPhase('game_on')
    await addPlayer('Player A')
    await post('/host/phase', { from: 'game_on', to: 'accusations_closed' })
    expect((await allPlayers())[0]).toMatchObject({ challenge: null, decoy: null })
  })
})

describe("fixing a player's completion", () => {
  const mark = (id: number, completed: boolean) =>
    post(`/host/players/${id}/completion`, { completed: String(completed) })

  it.each(['game_on', 'accusations_closed'] as const)('marks and unmarks in %s', async (phase) => {
    await setPhase(phase)
    const player = await addPlayer('Player A', { challenge: 1, decoy: 1 })
    const res = await mark(player.id, true)
    expect(res.headers.get('Location')).toBe(`/host/players/${player.id}?done=completion`)
    expect((await allPlayers())[0]?.completed).toBe(true)
    await mark(player.id, false)
    expect((await allPlayers())[0]?.completed).toBe(false)
  })

  it('shows the button while accusations are closed', async () => {
    await setPhase('accusations_closed')
    const player = await addPlayer('Player A', { challenge: 1, decoy: 1 })
    const html = await (await get(`/host/players/${player.id}`)).text()
    expect(html).toContain('Mark as done')
  })

  it.each(['lobby', 'reveal'] as const)('refuses in %s', async (phase) => {
    await setPhase(phase)
    const player = await addPlayer('Player A', { challenge: 1, decoy: 1, completed: phase === 'reveal' })
    const res = await mark(player.id, phase !== 'reveal')
    expect(res.headers.get('Location')).toBe(`/host/players/${player.id}?done=completion-refused`)
    expect((await allPlayers())[0]?.completed).toBe(phase === 'reveal')
    expect(await (await get(`/host/players/${player.id}`)).text()).not.toContain('as done</button>')
  })

  it('refuses for a player with no challenge yet', async () => {
    await setPhase('game_on')
    const player = await addPlayer('Player A')
    const res = await mark(player.id, true)
    expect(res.headers.get('Location')).toBe(`/host/players/${player.id}?done=completion-refused`)
    expect((await allPlayers())[0]?.completed).toBe(false)
  })

  it('explains a player left without a challenge during the game', async () => {
    await setPhase('game_on')
    const player = await addPlayer('Player A')
    const html = await (await get(`/host/players/${player.id}`)).text()
    expect(html).toContain('This player has no challenge yet')
    expect(html).not.toContain('once the game is on')
  })

  it('sends the host back to the list for a removed player', async () => {
    await setPhase('game_on')
    expect((await mark(999, true)).headers.get('Location')).toBe('/host?done=gone')
    expect((await get('/host/players/999')).headers.get('Location')).toBe('/host?done=gone')
  })

  it('ignores a bad value', async () => {
    await setPhase('game_on')
    const player = await addPlayer('Player A', { challenge: 1, decoy: 1 })
    const res = await post(`/host/players/${player.id}/completion`, { completed: 'yes' })
    expect(res.headers.get('Location')).toBe(`/host/players/${player.id}`)
    expect((await allPlayers())[0]?.completed).toBe(false)
  })
})

describe('removing a player', () => {
  it('asks the host to confirm first', async () => {
    const player = await addPlayer('Player A')
    const html = await (await get(`/host/players/${player.id}/remove`)).text()
    expect(html).toContain('Remove Player A?')
    expect(html).toMatch(/This can(&#39;|')t be undone\./)
    expect(await allPlayers()).toHaveLength(1)
  })

  it('removes them with the accusations they made and the ones about them', async () => {
    await setPhase('game_on')
    const a = await addPlayer('Player A', { challenge: 1, decoy: 1 })
    const b = await addPlayer('Player B', { challenge: 2, decoy: 2 })
    const c = await addPlayer('Player C', { challenge: 3, decoy: 3 })
    await db.insert(accusations).values([
      { accuserId: a.id, accusedId: b.id, challenge: 2 },
      { accuserId: b.id, accusedId: a.id, challenge: 5 },
      { accuserId: c.id, accusedId: a.id, challenge: 1 },
      { accuserId: b.id, accusedId: c.id, challenge: 3 },
    ])
    const res = await post(`/host/players/${a.id}/remove`)
    expect(res.headers.get('Location')).toBe('/host?done=removed')
    expect((await allPlayers()).map((p) => p.name)).toEqual(['Player B', 'Player C'])
    expect(await db.select().from(accusations).all()).toEqual([{ accuserId: b.id, accusedId: c.id, challenge: 3 }])
  })

  it('works in every phase', async () => {
    for (const phase of ['lobby', 'game_on', 'accusations_closed', 'reveal'] as const) {
      await setPhase(phase)
      const player = await addPlayer(`Player ${phase}`)
      await post(`/host/players/${player.id}/remove`)
      expect(await allPlayers()).toHaveLength(0)
    }
  })

  it('copes with a player already removed', async () => {
    expect((await post('/host/players/999/remove')).headers.get('Location')).toBe('/host?done=gone')
    expect((await get('/host/players/abc')).status).toBe(404)
  })
})

describe("resetting a player's PIN", () => {
  it('saves the new PIN as a fresh salted hash', async () => {
    const player = await addPlayer('Player A')
    const res = await post(`/host/players/${player.id}/pin`, { pin: '4821' })
    expect(res.headers.get('Location')).toBe(`/host/players/${player.id}?done=pin`)
    const [saved] = await allPlayers()
    expect(saved?.pinHash).not.toBe('hash')
    expect(saved?.pinSalt).not.toBe('salt')
    expect(await verifyPin('4821', saved!)).toBe(true)
    expect(await verifyPin('4822', saved!)).toBe(false)
  })

  it.each(['123', '12345', 'abcd', '12 4', ''])('refuses %j', async (pin) => {
    const player = await addPlayer('Player A')
    const res = await post(`/host/players/${player.id}/pin`, { pin })
    expect(res.headers.get('Location')).toBe(`/host/players/${player.id}`)
    expect((await allPlayers())[0]).toMatchObject({ pinHash: 'hash', pinSalt: 'salt' })
  })

  it('keeps everything else about the player', async () => {
    await setPhase('game_on')
    const player = await addPlayer('Player A', { challenge: 4, decoy: 6, completed: true })
    await post(`/host/players/${player.id}/pin`, { pin: '0000' })
    expect((await allPlayers())[0]).toMatchObject({ challenge: 4, decoy: 6, completed: true, name: 'Player A' })
  })
})

describe('join QR code', () => {
  it('shows a QR code and the link to the join page', async () => {
    const html = await (await get('/host/qr')).text()
    expect(html).toContain('<svg')
    expect(html).toContain('href="https://example.com/"')
  })
})

describe('emergency show all', () => {
  it('warns first and shows nothing until confirmed', async () => {
    await setPhase('game_on')
    await addPlayer('Player A', { challenge: 3, decoy: 7 })
    const html = await (await get('/host/all')).text()
    expect(html).toContain('Emergency')
    expect(html).toContain('method="post" action="/host/all"')
    expect(html).not.toMatch(/Challenge 3|Decoy 7/)
  })

  it("shows every player's challenge, decoy and completion once confirmed", async () => {
    await setPhase('game_on')
    await addPlayer('Player A', { challenge: 3, decoy: 7, completed: true })
    await addPlayer('Player B')
    const html = await (await post('/host/all')).text()
    expect(html).toMatch(/Player A<\/td><td>Challenge 3<\/td><td>Decoy 7<\/td><td>Yes/)
    expect(html).toMatch(/Player B<\/td><td>Not yet<\/td><td>Not yet<\/td><td>No/)
  })
})

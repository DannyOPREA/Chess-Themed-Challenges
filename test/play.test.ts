import { env } from 'cloudflare:test'
import { exports } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { hashPin } from '../src/auth/pin'
import { createDb } from '../src/db/client'
import { setOwnCompletion } from '../src/db/play'
import { game, players } from '../src/db/schema'
import { nameKey } from '../src/game/names'
import { PHASES, type Phase } from '../src/game/phases'
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

const getPlayer = async (id: number) => db.select().from(players).where(eq(players.id, id)).get()

// Logs in with name and PIN (joining or rejoining) and returns the cookie.
const logIn = async (name: string, pin = '0000') => {
  const res = await exports.default.fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE },
    body: new URLSearchParams({ name, pin }).toString(),
    redirect: 'manual',
  })
  expect(res.status).toBe(303)
  const cookie = res.headers
    .getSetCookie()
    .find((c) => c.startsWith('player='))
    ?.split(';')[0]
  if (!cookie) throw new Error('no player cookie was set')
  return cookie
}

const get = (path: string, cookie?: string, headers: Record<string, string> = {}) =>
  exports.default.fetch(`${BASE}${path}`, {
    headers: { ...(cookie && { Cookie: cookie }), ...headers },
    redirect: 'manual',
  })

const markDone = (cookie: string | undefined, completed: string, headers: Record<string, string> = {}) =>
  exports.default.fetch(`${BASE}/play/done`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: BASE,
      ...(cookie && { Cookie: cookie }),
      ...headers,
    },
    body: new URLSearchParams({ completed }).toString(),
    redirect: 'manual',
  })

const HTMX = { 'HX-Request': 'true' }

// Sam has challenge 3 and decoy 4; Alex, another player, has challenge 2 and
// decoy 5 and has done it.
const samAndAlex = async (phase: Phase) => {
  const sam = await addPlayer('Sam', '1234', { challenge: 3, decoy: 4 })
  const alex = await addPlayer('Alex', '0000', { challenge: 2, decoy: 5 })
  await db.update(players).set({ completed: true }).where(eq(players.id, alex.id))
  await setPhase(phase)
  return { sam, alex, cookie: await logIn('Sam', '1234') }
}

const page = async (cookie: string) => {
  const res = await get('/play', cookie)
  expect(res.status).toBe(200)
  return res.text()
}

// The `seen` key the screen's poll sends.
const seenKey = (html: string) => /hx-get="\/play\/status\?seen=([^"]+)"/.exec(html)?.[1]

describe('the player screen', () => {
  it('in the Lobby says the challenge comes when the game starts, with no button or links', async () => {
    const cookie = await logIn('Sam', '1234')
    const html = await page(cookie)
    expect(html).toContain('<h1>Sam</h1>')
    expect(html).toContain('Phase: <strong>Lobby</strong>')
    expect(html).toContain('appear here when the game starts')
    expect(html).not.toContain('/play/done')
    expect(html).not.toContain('/accuse')
    expect(html).not.toContain('/reveal')
    expect(html).toContain('Not Sam? Log out')
  })

  it('shows the hint list of all 20 challenge names and hints from the start, without descriptions', async () => {
    for (const phase of PHASES) {
      await resetDb()
      const { cookie } = await samAndAlex(phase)
      const html = await page(cookie)
      for (let n = 1; n <= 20; n++) {
        expect(html).toContain(`<dt><strong>Challenge ${n}</strong></dt><dd>Hint for Challenge ${n}</dd>`)
      }
      // Only the player's own challenge has its description shown.
      for (let n = 1; n <= 20; n++) {
        if (n !== 3 || phase === 'lobby') expect(html).not.toContain(`Description of Challenge ${n}<`)
      }
    }
  })

  it('in Game on shows the player their own challenge, decoy and completion, and the button', async () => {
    const { cookie } = await samAndAlex('game_on')
    const html = await page(cookie)
    expect(html).toContain('Phase: <strong>Game on</strong>')
    expect(html).toContain('<h3>Challenge 3</h3><p>Description of Challenge 3</p>')
    expect(html).toContain('<h3>Decoy 4</h3><p>Description of Decoy 4</p>')
    expect(html).toContain('Not done yet.')
    expect(html).toContain('<input type="hidden" name="completed" value="true"/>')
    expect(html).toContain('I&#39;ve done it')
    expect(html).toContain('href="/accuse"')
    expect(html).not.toContain('/reveal')
  })

  it("never shows another player's challenge, decoy or completion", async () => {
    for (const phase of ['game_on', 'accusations_closed'] as const) {
      await resetDb()
      const { cookie } = await samAndAlex(phase)
      for (const html of [await page(cookie), await (await get('/play/status', cookie, HTMX)).text()]) {
        expect(html).not.toContain('Alex')
        expect(html).not.toContain('Description of Challenge 2')
        expect(html).not.toMatch(/Decoy 5\b/)
        // Sam hasn't done theirs; Alex's completion doesn't show up as Sam's.
        expect(html).not.toContain('marked it done')
      }
    }
  })

  it('once accusations close shows the completion frozen, with no button', async () => {
    const { sam, cookie } = await samAndAlex('accusations_closed')
    await db.update(players).set({ completed: true }).where(eq(players.id, sam.id))
    const html = await page(cookie)
    expect(html).toContain('Phase: <strong>Accusations closed</strong>')
    expect(html).toContain('<h3>Challenge 3</h3>')
    expect(html).toContain('You&#39;ve marked it done.')
    expect(html).toContain('tell the host')
    await db.update(players).set({ completed: false }).where(eq(players.id, sam.id))
    expect(await page(cookie)).toContain('Not marked done.')
    expect(html).not.toContain('/play/done')
    expect(html).toContain('See your accusations')
    expect(html).not.toContain('/reveal')
  })

  it('in the Reveal links to the results', async () => {
    const { cookie } = await samAndAlex('reveal')
    const html = await page(cookie)
    expect(html).toContain('Phase: <strong>Reveal</strong>')
    expect(html).toContain('href="/reveal"')
    expect(html).not.toContain('/play/done')
    expect(html).not.toContain('/accuse')
  })

  it('tells a player who never got a challenge that they have none, once accusations close', async () => {
    await logIn('Sam', '1234')
    await setPhase('accusations_closed')
    const html = await page(await logIn('Sam', '1234'))
    expect(html).toContain('You weren&#39;t given a challenge')
    expect(html).not.toContain('/play/done')
  })

  it('is never cached, and reloads when a browser shows it again from memory', async () => {
    const { cookie } = await samAndAlex('game_on')
    const res = await get('/play', cookie)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    // An inline script, so no Content-Security-Policy may block inline scripts.
    expect(res.headers.get('Content-Security-Policy')).toBeNull()
    expect(await res.text()).toContain(
      "<script>addEventListener('pageshow', (e) => { if (e.persisted) location.reload() })</script>",
    )
    expect((await get('/play/status', cookie, HTMX)).headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('"I\'ve done it"', () => {
  it('marks the challenge done and can be undone, from a plain form', async () => {
    const { sam, cookie } = await samAndAlex('game_on')
    const res = await markDone(cookie, 'true')
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/play')
    expect((await getPlayer(sam.id))?.completed).toBe(true)
    let html = await page(cookie)
    expect(html).toContain('You&#39;ve marked it done.')
    expect(html).toContain('<input type="hidden" name="completed" value="false"/>')
    expect(html).toContain('Undo: I haven&#39;t done it')

    await markDone(cookie, 'false')
    expect((await getPlayer(sam.id))?.completed).toBe(false)
    html = await page(cookie)
    expect(html).toContain('Not done yet.')
    expect(html).toContain('I&#39;ve done it')
  })

  it('gives htmx the updated status section, without the page layout', async () => {
    const { cookie } = await samAndAlex('game_on')
    const res = await markDone(cookie, 'true', HTMX)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/^<section id="status"/)
    expect(html).not.toContain('<html')
    expect(html).toContain('You&#39;ve marked it done.')
    expect(html).toContain('Undo: I haven&#39;t done it')
  })

  it('is harmless when tapped twice', async () => {
    const { sam, cookie } = await samAndAlex('game_on')
    await markDone(cookie, 'true')
    await markDone(cookie, 'true')
    expect((await getPlayer(sam.id))?.completed).toBe(true)
  })

  it("only changes the player's own completion", async () => {
    const { alex, cookie } = await samAndAlex('game_on')
    await markDone(cookie, 'false')
    expect((await getPlayer(alex.id))?.completed).toBe(true)
  })

  it('is refused outside Game on, including from a screen loaded before accusations closed', async () => {
    for (const phase of ['accusations_closed', 'reveal'] as const) {
      await resetDb()
      const { sam, cookie } = await samAndAlex('game_on')
      // The screen was loaded in Game on; then the host moved the phase on.
      await page(cookie)
      await setPhase(phase)

      const res = await markDone(cookie, 'true')
      expect(res.status).toBe(303)
      expect(res.headers.get('Location')).toBe('/play?done=refused')
      expect((await getPlayer(sam.id))?.completed).toBe(false)
      expect(await page(`${cookie}`)).not.toContain('wasn&#39;t saved')
      expect(await (await get('/play?done=refused', cookie)).text()).toContain('That wasn&#39;t saved')

      const htmx = await (await markDone(cookie, 'true', HTMX)).text()
      expect(htmx).toContain('That wasn&#39;t saved')
      expect(htmx).not.toContain('/play/done')
      expect((await getPlayer(sam.id))?.completed).toBe(false)

      // The next poll clears the notice.
      const poll = await get(`/play/status?seen=${seenKey(htmx)}`, cookie, HTMX)
      expect(poll.status).toBe(200)
      expect(await poll.text()).not.toContain('wasn&#39;t saved')
    }
  })

  it('is refused in the Lobby, where nobody has a challenge yet', async () => {
    const sam = await addPlayer('Sam', '1234')
    const cookie = await logIn('Sam', '1234')
    const res = await markDone(cookie, 'true')
    expect(res.headers.get('Location')).toBe('/play?done=refused')
    expect((await getPlayer(sam.id))?.completed).toBe(false)
  })

  it('ignores a tampered form', async () => {
    const { sam, cookie } = await samAndAlex('game_on')
    for (const value of ['yes', '1', '']) {
      const res = await markDone(cookie, value)
      expect(res.status).toBe(303)
      expect(res.headers.get('Location')).toBe('/play')
      // htmx gets nothing to swap, rather than a whole page inside the screen.
      expect((await markDone(cookie, value, HTMX)).status).toBe(204)
    }
    expect((await getPlayer(sam.id))?.completed).toBe(false)
  })

  it('needs a logged-in phone', async () => {
    const { sam } = await samAndAlex('game_on')
    const res = await markDone(undefined, 'true')
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/')
    expect((await getPlayer(sam.id))?.completed).toBe(false)
  })

  it('stays as the host set it if the host overrides it', async () => {
    const { sam, cookie } = await samAndAlex('game_on')
    await markDone(cookie, 'true')
    await db.update(players).set({ completed: false }).where(eq(players.id, sam.id))
    expect(await page(cookie)).toContain('Not done yet.')
  })
})

describe('setOwnCompletion', () => {
  it('writes only in Game on, only for an assigned player who still exists', async () => {
    const sam = await addPlayer('Sam', '1234', { challenge: 3, decoy: 4 })
    const lobbyPlayer = await addPlayer('Lee')
    for (const phase of PHASES) {
      await setPhase(phase)
      expect(await setOwnCompletion(db, sam.id, true)).toBe(phase === 'game_on')
      await db.update(players).set({ completed: false }).where(eq(players.id, sam.id))
    }
    await setPhase('game_on')
    expect(await setOwnCompletion(db, lobbyPlayer.id, true)).toBe(false)
    expect(await setOwnCompletion(db, 999, true)).toBe(false)
  })
})

describe('the 10-second poll', () => {
  it('polls the status section every 10 seconds', async () => {
    const { cookie } = await samAndAlex('game_on')
    const html = await page(cookie)
    expect(html).toContain(
      '<section id="status" hx-get="/play/status?seen=game_on-1-0" hx-trigger="every 10s" hx-swap="outerHTML">',
    )
  })

  it('answers 204, so nothing is redrawn, while nothing has changed', async () => {
    const { cookie } = await samAndAlex('game_on')
    const key = seenKey(await page(cookie))
    const res = await get(`/play/status?seen=${key}`, cookie, HTMX)
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
  })

  it('sends the new status section when the phase changes', async () => {
    const { cookie } = await samAndAlex('game_on')
    const key = seenKey(await page(cookie))
    await setPhase('accusations_closed')
    const res = await get(`/play/status?seen=${key}`, cookie, HTMX)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/^<section id="status" hx-get="\/play\/status\?seen=accusations_closed-1-0"/)
    expect(html).toContain('Phase: <strong>Accusations closed</strong>')
    expect(html).not.toContain('/play/done')
  })

  it('sends the new status section when the host changes the completion', async () => {
    const { sam, cookie } = await samAndAlex('game_on')
    const key = seenKey(await page(cookie))
    await db.update(players).set({ completed: true }).where(eq(players.id, sam.id))
    const res = await get(`/play/status?seen=${key}`, cookie, HTMX)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('You&#39;ve marked it done.')
  })

  it('shows the challenge when the host starts Game on', async () => {
    const sam = await addPlayer('Sam', '1234')
    const cookie = await logIn('Sam', '1234')
    const key = seenKey(await page(cookie))
    expect(key).toBe('lobby-0-0')
    await db.update(players).set({ challenge: 3, decoy: 4 }).where(eq(players.id, sam.id))
    await setPhase('game_on')
    const html = await (await get(`/play/status?seen=${key}`, cookie, HTMX)).text()
    expect(html).toContain('<h3>Challenge 3</h3>')
    expect(html).toContain('<h3>Decoy 4</h3>')
  })

  it('moves a screen to the results when the host starts the Reveal, once', async () => {
    const { cookie } = await samAndAlex('accusations_closed')
    const key = seenKey(await page(cookie))
    await setPhase('reveal')
    const res = await get(`/play/status?seen=${key}`, cookie, HTMX)
    expect(res.headers.get('HX-Redirect')).toBe('/reveal')
    expect(await res.text()).toBe('')
    // Coming back to the player screen during the Reveal stays there.
    const again = seenKey(await page(cookie))
    expect(again).toBe('reveal-1-0')
    expect((await get(`/play/status?seen=${again}`, cookie, HTMX)).status).toBe(204)
    const notice = await get(`/play/status?seen=${again}-refused`, cookie, HTMX)
    expect(notice.headers.get('HX-Redirect')).toBeNull()
    expect(await notice.text()).toContain('href="/reveal"')
  })

  it('sends a phone that is no longer logged in to the join page', async () => {
    const { sam, cookie } = await samAndAlex('game_on')
    await db.delete(players).where(eq(players.id, sam.id))
    const res = await get('/play/status?seen=game_on-1-0', cookie, HTMX)
    expect(res.headers.get('HX-Redirect')).toBe('/')
  })
})

import { env } from 'cloudflare:test'
import { exports } from 'cloudflare:workers'
import { and, eq } from 'drizzle-orm'
import { generateSignedCookie } from 'hono/cookie'
import { beforeEach, describe, expect, it } from 'vitest'
import { hashPin } from '../src/auth/pin'
import { listTargets, setGuess } from '../src/db/accusations'
import { createDb } from '../src/db/client'
import { accusations, game, type Player, players } from '../src/db/schema'
import { nameKey } from '../src/game/names'
import type { Phase } from '../src/game/phases'
import { resetDb } from './reset-db'

const db = createDb(env.DB)
const BASE = 'https://example.com'

beforeEach(resetDb)

const setPhase = (phase: Phase) => db.update(game).set({ phase })

// Players are added already assigned, as they are once Game on starts:
// player n has challenge n and decoy n.
let next = 1
const addPlayer = async (name: string): Promise<Player> => {
  const n = next++
  const [player] = await db
    .insert(players)
    .values({ name, nameKey: nameKey(name), ...(await hashPin('0000')), challenge: n, decoy: n })
    .returning()
  if (!player) throw new Error('insert returned nothing')
  return player
}

beforeEach(() => {
  next = 1
})

// The signed cookie unit 3.01 gives a player's phone.
const cookieFor = async (p: Player) =>
  (
    await generateSignedCookie(
      'player',
      `${p.id}.${Math.floor(p.joinedAt.getTime() / 1000)}`,
      env.COOKIE_SECRET,
    )
  ).split(';')[0]!

const get = async (path: string, player?: Player, headers: Record<string, string> = {}) =>
  exports.default.fetch(`${BASE}${path}`, {
    headers: { ...(player && { Cookie: await cookieFor(player) }), ...headers },
    redirect: 'manual',
  })

const post = async (
  player: Player,
  form: Record<string, string>,
  headers: Record<string, string> = {},
) =>
  exports.default.fetch(`${BASE}/accuse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: BASE,
      Cookie: await cookieFor(player),
      ...headers,
    },
    body: new URLSearchParams(form).toString(),
    redirect: 'manual',
  })

const htmx = { 'HX-Request': 'true' }

const allAccusations = () =>
  db
    .select({ accuserId: accusations.accuserId, accusedId: accusations.accusedId, challenge: accusations.challenge })
    .from(accusations)
    .all()

const guessOf = async (accuser: Player, accused: Player) =>
  (
    await db
      .select({ challenge: accusations.challenge })
      .from(accusations)
      .where(and(eq(accusations.accuserId, accuser.id), eq(accusations.accusedId, accused.id)))
      .get()
  )?.challenge

describe('setGuess', () => {
  it('keeps one active guess per other player, which can be changed and cleared', async () => {
    const [ann, bob] = [await addPlayer('Ann'), await addPlayer('Bob')]
    await setPhase('game_on')
    expect(await setGuess(db, ann.id, bob.id, 7)).toBe('saved')
    expect(await allAccusations()).toEqual([{ accuserId: ann.id, accusedId: bob.id, challenge: 7 }])
    expect(await setGuess(db, ann.id, bob.id, 2)).toBe('saved')
    expect(await allAccusations()).toEqual([{ accuserId: ann.id, accusedId: bob.id, challenge: 2 }])
    expect(await setGuess(db, ann.id, bob.id, null)).toBe('saved')
    expect(await allAccusations()).toEqual([])
    // Clearing a guess that isn't there is fine.
    expect(await setGuess(db, ann.id, bob.id, null)).toBe('saved')
  })

  it('keeps guesses about different players, and by different players, apart', async () => {
    const [ann, bob, cat] = [await addPlayer('Ann'), await addPlayer('Bob'), await addPlayer('Cat')]
    await setPhase('game_on')
    await setGuess(db, ann.id, bob.id, 3)
    await setGuess(db, ann.id, cat.id, 4)
    await setGuess(db, bob.id, cat.id, 5)
    await setGuess(db, ann.id, cat.id, null)
    expect(await guessOf(ann, bob)).toBe(3)
    expect(await guessOf(ann, cat)).toBeUndefined()
    expect(await guessOf(bob, cat)).toBe(5)
  })

  it('refuses accusing yourself', async () => {
    const ann = await addPlayer('Ann')
    await setPhase('game_on')
    expect(await setGuess(db, ann.id, ann.id, 1)).toBe('self')
    expect(await allAccusations()).toEqual([])
  })

  it('refuses making, changing or clearing a guess outside Game on', async () => {
    const [ann, bob] = [await addPlayer('Ann'), await addPlayer('Bob')]
    expect(await setGuess(db, ann.id, bob.id, 7)).toBe('closed')
    expect(await allAccusations()).toEqual([])
    await setPhase('game_on')
    await setGuess(db, ann.id, bob.id, 7)
    for (const phase of ['accusations_closed', 'reveal'] as const) {
      await setPhase(phase)
      expect(await setGuess(db, ann.id, bob.id, 2)).toBe('closed')
      expect(await setGuess(db, ann.id, bob.id, null)).toBe('closed')
      expect(await guessOf(ann, bob)).toBe(7)
    }
  })

  it('refuses a guess about, or by, a removed player', async () => {
    const [ann, bob] = [await addPlayer('Ann'), await addPlayer('Bob')]
    await setPhase('game_on')
    await db.delete(players).where(eq(players.id, bob.id))
    expect(await setGuess(db, ann.id, bob.id, 7)).toBe('gone')
    expect(await setGuess(db, bob.id, ann.id, 7)).toBe('gone')
    expect(await setGuess(db, ann.id, bob.id, null)).toBe('gone')
    expect(await allAccusations()).toEqual([])
  })

  it('lists everyone else by name with only this player’s own guesses', async () => {
    const [cat, ann, bob] = [await addPlayer('cat'), await addPlayer('Ann'), await addPlayer('Bob')]
    await setPhase('game_on')
    await setGuess(db, ann.id, cat.id, 9)
    await setGuess(db, bob.id, cat.id, 1)
    await setGuess(db, cat.id, ann.id, 2)
    expect(await listTargets(db, ann.id)).toEqual([
      { id: bob.id, name: 'Bob', guess: null },
      { id: cat.id, name: 'cat', guess: 9 },
    ])
  })
})

describe('the accusations screen', () => {
  it('sends a phone that is not logged in to the join page', async () => {
    const res = await get('/accuse')
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/')
    const poll = await get('/accuse/poll?v=x', undefined, htmx)
    expect(poll.headers.get('HX-Redirect')).toBe('/')
  })

  it('says accusations open when the game starts, in the Lobby', async () => {
    const [ann] = [await addPlayer('Ann'), await addPlayer('Bob')]
    const html = await (await get('/accuse', ann)).text()
    expect(html).toContain('Accusations open when the game starts.')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('Bob')
  })

  it('lists every other player, never the player themselves, with the 20 challenge names', async () => {
    const [ann] = [await addPlayer('Ann'), await addPlayer('Bob'), await addPlayer('Cat')]
    await setPhase('game_on')
    const html = await (await get('/accuse', ann)).text()
    expect(html).toContain('<strong>Bob</strong>')
    expect(html).toContain('<strong>Cat</strong>')
    expect(html).not.toContain('<strong>Ann</strong>')
    expect(html).not.toContain(`name="accused" value="${ann.id}"`)
    expect(html.match(/<form /g)).toHaveLength(2)
    // "No guess" plus Challenge 1 to 20, for each of the two players.
    expect(html.match(/<option /g)).toHaveLength(42)
    expect(html).toContain('<option value="20">Challenge 20</option>')
    expect(html).toContain('You have a guess for 0 of 2 players.')
  })

  it('says so when nobody else has joined', async () => {
    const ann = await addPlayer('Ann')
    await setPhase('game_on')
    expect(await (await get('/accuse', ann)).text()).toContain('Nobody else has joined yet.')
  })

  it("shows the player's own guesses and nothing about anyone else's (no spoilers)", async () => {
    const [ann, bob, cat] = [await addPlayer('Ann'), await addPlayer('Bob'), await addPlayer('Cat')]
    await setPhase('game_on')
    await db.update(players).set({ completed: true }).where(eq(players.id, bob.id))
    // Ann's right guess about Bob, Bob's guess about Cat and Cat's about Ann.
    await setGuess(db, ann.id, bob.id, 2)
    await setGuess(db, bob.id, cat.id, 3)
    await setGuess(db, cat.id, ann.id, 1)
    const html = await (await get('/accuse', ann)).text()
    expect(html).toContain('You have a guess for 1 of 2 players.')
    // Only Ann's own guess is selected.
    expect(html.match(/<option [^>]*selected/g)).toEqual([
      '<option value="2" selected',
      '<option value="" selected',
    ])
    expect(html).not.toMatch(/Decoy|Description|Hint|correct|wrong|detected|completed|done/i)
  })

  it('answers a right guess and a wrong one the same way', async () => {
    const [ann, bob] = [await addPlayer('Ann'), await addPlayer('Bob')]
    await setPhase('game_on')
    // Bob's challenge is 2.
    const right = await post(ann, { accused: String(bob.id), challenge: '2' }, htmx)
    const rightHtml = await right.text()
    const wrong = await post(ann, { accused: String(bob.id), challenge: '5' }, htmx)
    const wrongHtml = await wrong.text()
    expect(right.status).toBe(wrong.status)
    // Identical apart from the name of the challenge picked.
    expect(rightHtml).toContain('Saved: Challenge 2.')
    expect(wrongHtml).toContain('Saved: Challenge 5.')
    expect(rightHtml.replace('Challenge 2', 'X')).toBe(wrongHtml.replace('Challenge 5', 'X'))
    const plainRight = await post(ann, { accused: String(bob.id), challenge: '2' })
    const plainWrong = await post(ann, { accused: String(bob.id), challenge: '5' })
    expect(plainRight.headers.get('Location')).toBe(plainWrong.headers.get('Location'))
  })

  it('saves, changes and clears a guess with a plain form post', async () => {
    const [ann, bob] = [await addPlayer('Ann'), await addPlayer('Bob')]
    await setPhase('game_on')
    // Back to the same row, which says what was saved.
    const rowUrl = `/accuse?saved=${bob.id}#player-${bob.id}`
    let res = await post(ann, { accused: String(bob.id), challenge: '7' })
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe(rowUrl)
    expect(await guessOf(ann, bob)).toBe(7)
    expect(await (await get(`/accuse?saved=${bob.id}`, ann)).text()).toContain(
      `<small id="status-${bob.id}" role="status">Saved: Challenge 7.</small>`,
    )
    res = await post(ann, { accused: String(bob.id), challenge: '8' })
    expect(await guessOf(ann, bob)).toBe(8)
    res = await post(ann, { accused: String(bob.id), challenge: '' })
    expect(res.headers.get('Location')).toBe(rowUrl)
    expect(await guessOf(ann, bob)).toBeUndefined()
    expect(await (await get(`/accuse?saved=${bob.id}`, ann)).text()).toContain(
      `<small id="status-${bob.id}" role="status">Guess cleared.</small>`,
    )
  })

  it('saves a guess with htmx and returns the row status and the new count', async () => {
    const [ann, bob] = [await addPlayer('Ann'), await addPlayer('Bob'), await addPlayer('Cat')]
    await setPhase('game_on')
    const page = await (await get('/accuse', ann)).text()
    expect(page).toContain(`hx-target="#status-${bob.id}"`)
    expect(page).toContain(`<small id="status-${bob.id}" role="status"></small>`)
    // The row says when a save is being sent, and when it never arrived.
    expect(page).toContain(
      `hx-on::before-request="this.querySelector(&#39;[role=status]&#39;).textContent = &quot;Saving…&quot;"`,
    )
    expect(page).toMatch(/hx-on::send-error="[^"]*Not saved/)
    expect(page).toMatch(/hx-on::response-error="[^"]*Not saved/)
    expect(page).toContain('<p id="guess-count">You have a guess for 0 of 2 players.</p>')

    const res = await post(ann, { accused: String(bob.id), challenge: '7' }, htmx)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toBe(
      'Saved: Challenge 7.<p id="guess-count" hx-swap-oob="true">You have a guess for 1 of 2 players.</p>',
    )
    expect(await guessOf(ann, bob)).toBe(7)
    const cleared = await (await post(ann, { accused: String(bob.id), challenge: '' }, htmx)).text()
    expect(cleared).toBe(
      'Guess cleared.<p id="guess-count" hx-swap-oob="true">You have a guess for 0 of 2 players.</p>',
    )
    expect(await guessOf(ann, bob)).toBeUndefined()
  })

  it('refuses accusing yourself and bad forms, storing nothing', async () => {
    const [ann, bob] = [await addPlayer('Ann'), await addPlayer('Bob')]
    await setPhase('game_on')
    const bad: Record<string, string>[] = [
      { accused: String(ann.id), challenge: '1' },
      { accused: String(bob.id), challenge: '0' },
      { accused: String(bob.id), challenge: '21' },
      { accused: String(bob.id), challenge: '1.5' },
      { accused: String(bob.id), challenge: 'Challenge 1' },
      { accused: 'x', challenge: '1' },
      { accused: String(bob.id) },
      {},
    ]
    for (const form of bad) {
      const res = await post(ann, form)
      expect(res.status).toBe(303)
      expect(res.headers.get('Location')).toBe('/accuse')
      const viaHtmx = await post(ann, form, htmx)
      expect(viaHtmx.headers.get('HX-Redirect')).toBe('/accuse')
    }
    expect(await allAccusations()).toEqual([])
  })

  it('freezes guesses once accusations close, and shows them read-only', async () => {
    const [ann, bob, cat] = [await addPlayer('Ann'), await addPlayer('Bob'), await addPlayer('Cat')]
    await setPhase('game_on')
    await setGuess(db, ann.id, bob.id, 4)
    for (const phase of ['accusations_closed', 'reveal'] as const) {
      await setPhase(phase)
      const res = await post(ann, { accused: String(bob.id), challenge: '9' })
      expect(res.headers.get('Location')).toBe('/accuse?done=closed')
      const viaHtmx = await post(ann, { accused: String(cat.id), challenge: '9' }, htmx)
      expect(viaHtmx.headers.get('HX-Redirect')).toBe('/accuse?done=closed')
      expect(await allAccusations()).toEqual([{ accuserId: ann.id, accusedId: bob.id, challenge: 4 }])
      const html = await (await get('/accuse?done=closed', ann)).text()
      expect(html).toContain("Accusations are closed, so that guess wasn&#39;t changed.")
      expect(html).not.toContain('<form')
      expect(html).not.toContain('<select')
      expect(html).toContain('<strong>Bob</strong>: Challenge 4')
      expect(html).toContain('<strong>Cat</strong>: no guess')
    }
  })

  it('tells the player when the accused has left the game', async () => {
    const [ann, bob] = [await addPlayer('Ann'), await addPlayer('Bob')]
    await setPhase('game_on')
    await db.delete(players).where(eq(players.id, bob.id))
    const res = await post(ann, { accused: String(bob.id), challenge: '2' })
    expect(res.headers.get('Location')).toBe('/accuse?done=gone')
    expect(await allAccusations()).toEqual([])
  })

  it('refuses a post from another site', async () => {
    const [ann, bob] = [await addPlayer('Ann'), await addPlayer('Bob')]
    await setPhase('game_on')
    const res = await post(ann, { accused: String(bob.id), challenge: '2' }, { Origin: 'https://evil.example' })
    expect(res.status).toBe(403)
    expect(await allAccusations()).toEqual([])
  })
})

describe('the 10-second poll', () => {
  const pollUrl = (html: string) => {
    const match = /hx-get="(\/accuse\/poll\?v=[0-9a-f]+)"/.exec(html)
    if (!match) throw new Error('no poll on the page')
    return match[1]!
  }

  it('does nothing until the phase or the players change', async () => {
    const [ann, bob] = [await addPlayer('Ann'), await addPlayer('Bob')]
    await setPhase('game_on')
    const url = pollUrl(await (await get('/accuse', ann)).text())
    expect((await get(url, ann, htmx)).status).toBe(204)
    // The player's own guesses don't reload the page.
    await setGuess(db, ann.id, bob.id, 3)
    expect((await get(url, ann, htmx)).status).toBe(204)

    await addPlayer('Cat')
    const res = await get(url, ann, htmx)
    // A fresh screen, without any old `?done=` notice.
    expect(res.headers.get('HX-Redirect')).toBe('/accuse')
  })

  it('reloads the page when a player is removed', async () => {
    const [ann, bob] = [await addPlayer('Ann'), await addPlayer('Bob'), await addPlayer('Cat')]
    await setPhase('game_on')
    const url = pollUrl(await (await get('/accuse', ann)).text())
    await db.delete(players).where(eq(players.id, bob.id))
    expect((await get(url, ann, htmx)).headers.get('HX-Redirect')).toBe('/accuse')
  })

  it('skips a tick while a save is being sent', async () => {
    const ann = await addPlayer('Ann')
    await setPhase('game_on')
    expect(await (await get('/accuse', ann)).text()).toContain(
      `hx-trigger="every 10s [!document.querySelector(&#39;.htmx-request&#39;)]"`,
    )
  })

  it('reloads the page when accusations close', async () => {
    const [ann] = [await addPlayer('Ann'), await addPlayer('Bob')]
    await setPhase('game_on')
    const url = pollUrl(await (await get('/accuse', ann)).text())
    await setPhase('accusations_closed')
    expect((await get(url, ann, htmx)).headers.get('HX-Redirect')).toBe('/accuse')
  })

  it('polls in the Lobby, so the screen opens when the game starts, and stops at the Reveal', async () => {
    const ann = await addPlayer('Ann')
    const url = pollUrl(await (await get('/accuse', ann)).text())
    // The Lobby screen lists nobody, so a joiner doesn't reload it.
    await addPlayer('Bob')
    expect((await get(url, ann, htmx)).status).toBe(204)
    await setPhase('game_on')
    expect((await get(url, ann, htmx)).headers.get('HX-Redirect')).toBe('/accuse')
    await setPhase('reveal')
    expect(await (await get('/accuse', ann)).text()).not.toContain('every 10s')
  })
})

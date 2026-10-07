import type { Context } from 'hono'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import type { CookieOptions } from 'hono/utils/cookie'
import { createMiddleware } from 'hono/factory'
import { eq } from 'drizzle-orm'
import { createDb } from '../db/client'
import { ensureAssigned } from '../db/players'
import { type Player, players } from '../db/schema'
import type { AppEnv } from '../env'

// The phone remembers its player in a cookie signed with COOKIE_SECRET
// (docs/scope.md, "Joining and rejoining"). It holds the player's id and the
// time they joined, so a phone holding a removed player's cookie, or one from
// an earlier game, is treated as logged out rather than as someone else.

const COOKIE = 'player'

// `Secure` whenever the app is served over HTTPS, as it always is in
// production. Not on `npm run dev`'s plain http://localhost, where Safari would
// otherwise drop the cookie.
const cookieOptions = (c: Context): CookieOptions => ({
  path: '/',
  httpOnly: true,
  secure: new URL(c.req.url).protocol === 'https:',
  sameSite: 'Lax',
  // Long enough to outlast one night out; game data cleared in between (unit
  // 4.01) logs everyone out anyway, because the join time no longer matches.
  maxAge: 7 * 24 * 60 * 60,
})

const cookieValue = (player: Pick<Player, 'id' | 'joinedAt'>) =>
  `${player.id}.${Math.floor(player.joinedAt.getTime() / 1000)}`

export const logIn = <E extends AppEnv>(c: Context<E>, player: Pick<Player, 'id' | 'joinedAt'>) =>
  setSignedCookie(c, COOKIE, cookieValue(player), c.env.COOKIE_SECRET, cookieOptions(c))

export const logOut = <E extends AppEnv>(c: Context<E>) => {
  deleteCookie(c, COOKIE, cookieOptions(c))
}

// The player this phone is logged in as, or nothing (no cookie, a cookie that
// fails its signature, or a player who was removed). A player with no
// challenge yet during Game on is assigned one here (unit 2.02's handover),
// so every screen that calls this sees the player's numbers.
export const getCurrentPlayer = async <E extends AppEnv>(
  c: Context<E>,
): Promise<Player | undefined> => {
  const value = await getSignedCookie(c, c.env.COOKIE_SECRET, COOKIE)
  const match = value ? /^(\d+)\.(\d+)$/.exec(value) : null
  if (!match) return undefined
  const db = createDb(c.env.DB)
  const player = await db
    .select()
    .from(players)
    .where(eq(players.id, Number(match[1])))
    .get()
  if (!player || cookieValue(player) !== value) return undefined
  return ensureAssigned(db, player)
}

export type PlayerEnv = AppEnv & { Variables: { player: Player } }

// For every player screen: sets `c.var.player`, or sends a phone that isn't
// logged in back to the join page. An htmx request (such as a screen's
// 10-second poll) gets an `HX-Redirect` header instead, so htmx loads the join
// page as a whole page rather than swapping it into part of a screen.
export const requirePlayer = createMiddleware<PlayerEnv>(async (c, next) => {
  const player = await getCurrentPlayer(c)
  if (!player) {
    logOut(c)
    if (c.req.header('HX-Request')) {
      c.header('HX-Redirect', '/')
      return c.body(null, 200)
    }
    return c.redirect('/', 303)
  }
  c.set('player', player)
  await next()
})

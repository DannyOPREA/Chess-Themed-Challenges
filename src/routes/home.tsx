import { zValidator } from '@hono/zod-validator'
import { type Context, Hono } from 'hono'
import { z } from 'zod'
import { pinSchema, hashPin, verifyPin } from '../auth/pin'
import { getCurrentPlayer, logIn, logOut } from '../auth/session'
import { createDb } from '../db/client'
import { getPhase } from '../db/game'
import { createPlayer, ensureAssigned, findPlayerByName } from '../db/players'
import type { Player } from '../db/schema'
import type { AppEnv } from '../env'
import { cleanName } from '../game/names'
import { type Phase, phaseAllows } from '../game/phases'

// The start page, where players join with a name and a 4-digit PIN, or get
// back in from another phone with the same name and PIN (docs/scope.md,
// "Joining and rejoining"). The join QR code points here. A phone that is
// already logged in goes straight to the player screen.
export const home = new Hono<AppEnv>()

export const NAME_MAX_LENGTH = 30

// A missing field counts as empty, so it gets the same message as a blank one.
const joinSchema = z.object({
  name: z
    .string({ error: 'Enter your name.' })
    .default('')
    .transform(cleanName)
    .pipe(
      z
        .string()
        .min(1, 'Enter your name.')
        .max(NAME_MAX_LENGTH, `Keep your name to ${NAME_MAX_LENGTH} characters or fewer.`),
    ),
  pin: z.string({ error: 'The PIN must be 4 digits' }).default('').pipe(pinSchema),
})

const NAME_TAKEN =
  "That name is already taken. If it's you, check your PIN; if not, choose a different name."
// Once new players can't join, choosing another name doesn't help.
const WRONG_PIN = "That PIN doesn't match that name. Check your PIN, or ask the host to reset it."
const GAME_CLOSED =
  'Nobody has joined with that name, and new players can no longer join. Check the spelling of your name.'

const JoinPage = ({ phase, name, error }: { phase: Phase; name?: string; error?: string }) => {
  const open = phaseAllows(phase, 'join')
  return (
    <>
      <hgroup>
        <h1>Chess pub crawl</h1>
        <p>{open ? 'Join the game' : 'Get back in'}</p>
      </hgroup>
      <p>
        {open
          ? "Pick a name and a 4-digit PIN, and remember the PIN. If you've joined before, use the same name and PIN to get back in."
          : 'The game has closed to new players. If you joined earlier, enter your name and PIN to get back in.'}
      </p>
      {error && (
        <p role="alert">
          <strong>{error}</strong>
        </p>
      )}
      <form method="post" action="/">
        <label>
          Name
          <input
            name="name"
            value={name}
            required
            maxlength={NAME_MAX_LENGTH}
            autocomplete="nickname"
            autocapitalize="words"
            aria-invalid={error ? 'true' : undefined}
          />
        </label>
        <label>
          4-digit PIN
          <input
            name="pin"
            type="password"
            inputmode="numeric"
            pattern="[0-9]{4}"
            minlength={4}
            maxlength={4}
            required
            autocomplete="off"
            aria-invalid={error ? 'true' : undefined}
          />
        </label>
        <button type="submit">{open ? 'Join' : 'Get back in'}</button>
      </form>
    </>
  )
}

const TITLE = 'Join the chess pub crawl'

const renderJoin = (c: Context, phase: Phase, name?: string, error?: string) => {
  if (error) c.status(400)
  return c.render(<JoinPage phase={phase} name={name} error={error} />, { title: TITLE })
}

home.get('/', async (c) => {
  if (await getCurrentPlayer(c)) return c.redirect('/play', 303)
  return renderJoin(c, await getPhase(createDb(c.env.DB)))
})

home.post(
  '/',
  zValidator('form', joinSchema, async (result, c) => {
    if (result.success) return
    const name = typeof result.data.name === 'string' ? cleanName(result.data.name) : undefined
    // The hook's context isn't typed with this app's bindings.
    const phase = await getPhase(createDb((c.env as Env).DB))
    return renderJoin(c, phase, name, result.error.issues[0]?.message ?? 'Check your name and PIN.')
  }),
  async (c) => {
    const { name, pin } = c.req.valid('form')
    const db = createDb(c.env.DB)

    // A new name joins, if the phase allows it when the player is added. A
    // name already taken (ignoring capitals) is a rejoin, in any phase, and
    // needs the right PIN; the player keeps everything they had. If someone
    // else took the name between the lookup and the insert, that is treated
    // as a rejoin too.
    let player = await findPlayerByName(db, name)
    let created: Player | undefined
    if (!player) {
      created = await createPlayer(db, name, await hashPin(pin))
      player = created ?? (await findPlayerByName(db, name))
      if (!player) return renderJoin(c, await getPhase(db), name, GAME_CLOSED)
    }
    if (player !== created && !(await verifyPin(pin, player))) {
      const phase = await getPhase(db)
      return renderJoin(c, phase, name, phaseAllows(phase, 'join') ? NAME_TAKEN : WRONG_PIN)
    }

    // A late joiner during Game on gets their challenge and decoy now.
    const assigned = await ensureAssigned(db, player)
    if (!assigned) {
      return renderJoin(c, await getPhase(db), name, 'You were removed from the game just now. Ask the host.')
    }
    await logIn(c, assigned)
    return c.redirect('/play', 303)
  },
)

// "Not you?" on the player screen: forget the player on this phone, so
// someone else can log in on it. Their name and PIN still get them back in.
home.post('/logout', (c) => {
  logOut(c)
  return c.redirect('/', 303)
})

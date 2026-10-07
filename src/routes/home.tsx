import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
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

const joinSchema = z.object({
  name: z
    .string()
    .transform(cleanName)
    .pipe(
      z
        .string()
        .min(1, 'Enter your name.')
        .max(NAME_MAX_LENGTH, `Keep your name to ${NAME_MAX_LENGTH} characters or fewer.`),
    ),
  pin: pinSchema,
})

const NAME_TAKEN =
  "That name is already taken. If it's you, check your PIN; if not, choose a different name."
const GAME_CLOSED =
  "The game has closed to new players. If you've already joined, enter the same name and PIN to get back in."

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

home.get('/', async (c) => {
  if (await getCurrentPlayer(c)) return c.redirect('/play', 303)
  const phase = await getPhase(createDb(c.env.DB))
  return c.render(<JoinPage phase={phase} />, { title: 'Join the chess pub crawl' })
})

home.post(
  '/',
  zValidator('form', joinSchema, async (result, c) => {
    if (result.success) return
    const name = typeof result.data.name === 'string' ? cleanName(result.data.name) : undefined
    // The hook's context isn't typed with this app's bindings.
    const phase = await getPhase(createDb((c.env as Env).DB))
    c.status(400)
    return c.render(<JoinPage phase={phase} name={name} error={result.error.issues[0]?.message} />, {
      title: 'Join the chess pub crawl',
    })
  }),
  async (c) => {
    const { name, pin } = c.req.valid('form')
    const db = createDb(c.env.DB)
    const phase = await getPhase(db)
    const refuse = (error: string) => {
      c.status(400)
      return c.render(<JoinPage phase={phase} name={name} error={error} />, {
        title: 'Join the chess pub crawl',
      })
    }

    // A new name joins, while the phase allows it. A name already taken
    // (ignoring capitals) is a rejoin, in any phase, and needs the right PIN;
    // the player keeps everything they had. If someone else took the name
    // between the lookup and the insert, that is treated as a rejoin too.
    let player = await findPlayerByName(db, name)
    let created: Player | undefined
    if (!player) {
      if (!phaseAllows(phase, 'join')) return refuse(GAME_CLOSED)
      created = await createPlayer(db, name, await hashPin(pin))
      player = created ?? (await findPlayerByName(db, name))
      if (!player) throw new Error('A player who just joined is missing')
    }
    if (player !== created && !(await verifyPin(pin, player))) return refuse(NAME_TAKEN)

    // A late joiner during Game on gets their challenge and decoy now.
    const assigned = await ensureAssigned(db, player)
    if (!assigned) return refuse('You were removed from the game just now. Ask the host.')
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

import { zValidator } from '@hono/zod-validator'
import { type Context, Hono } from 'hono'
import { sha256 } from 'hono/utils/crypto'
import { z } from 'zod'
import { type PlayerEnv, requirePlayer } from '../auth/session'
import { CONTENT_SIZE, type Content, getChallenge, loadContent } from '../content'
import { listTargets, setGuess, type Target } from '../db/accusations'
import { createDb } from '../db/client'
import { getPhase } from '../db/game'
import { type Phase, phaseAllows } from '../game/phases'

// The accusations screen (docs/scope.md, "Player screen"): pick another
// player, then a challenge name. One active guess per other player, which the
// player can change or clear until accusations close. It shows only the
// player's own guesses and never whether one is right (CLAUDE.md rule 2).
export const accusations = new Hono<PlayerEnv>()

// `/accuse/*` also matches `/accuse` itself.
accusations.use('/accuse/*', requirePlayer)

// Short messages after an action, passed back in the URL as `?done=<key>`
// (for phones without JavaScript, and when an htmx save is refused).
const NOTICES = {
  saved: 'Guess saved.',
  cleared: 'Guess cleared.',
  closed: "Accusations are closed, so that guess wasn't changed.",
  gone: 'That player has left the game.',
} as const
type NoticeKey = keyof typeof NOTICES

const Notice = ({ done }: { done: string | undefined }) =>
  done && Object.hasOwn(NOTICES, done) ? (
    <article role="status">
      <strong>{NOTICES[done as NoticeKey]}</strong>
    </article>
  ) : null

// The challenge list in content order, as the hint list shows it.
const ChallengeOptions = ({ content, guess }: { content: Content; guess: number | null }) => (
  <>
    <option value="" selected={guess === null}>
      No guess
    </option>
    {content.challenges.map((ch, i) => (
      <option value={String(i + 1)} selected={guess === i + 1}>
        {ch.name}
      </option>
    ))}
  </>
)

// One player's row while accusations are open. With htmx, picking a challenge
// saves straight away and the row is swapped for the saved one; without it,
// the Save button posts the form and the page reloads.
const GuessForm = ({
  target,
  content,
  saved,
}: {
  target: Target
  content: Content
  saved?: boolean
}) => (
  <form
    id={`player-${target.id}`}
    method="post"
    action="/accuse"
    hx-post="/accuse"
    hx-trigger="change, submit"
    hx-target="this"
    hx-swap="outerHTML"
  >
    <input type="hidden" name="accused" value={String(target.id)} />
    <label for={`guess-${target.id}`}>
      <strong>{target.name}</strong>
    </label>
    <fieldset role="group">
      <select id={`guess-${target.id}`} name="challenge">
        <ChallengeOptions content={content} guess={target.guess} />
      </select>
      <button type="submit" class="secondary">
        Save
      </button>
    </fieldset>
    {saved ? (
      <small role="status">{target.guess === null ? 'Guess cleared.' : 'Guess saved.'}</small>
    ) : null}
  </form>
)

// One player's row once accusations are closed (or before they open).
const GuessRow = ({ target, content }: { target: Target; content: Content }) => (
  <li>
    <strong>{target.name}</strong>:{' '}
    {target.guess === null ? 'no guess' : getChallenge(content, target.guess).name}
  </li>
)

const INTRO: Record<Phase, string> = {
  lobby: 'Accusations open when the game starts.',
  game_on:
    "Pick the challenge you think each player has. You can change or clear a guess until the host closes accusations. Nobody finds out whether a guess is right until the reveal, and nobody sees who you've accused.",
  accusations_closed: 'Accusations are closed. These are your final guesses.',
  reveal: 'Accusations are closed. These were your final guesses.',
}

// A fingerprint of what the 10-second poll watches: the phase and the other
// players. Not the player's own guesses, or every save would reload the page a
// few seconds later. Hashed only to keep the URL short.
const fingerprint = (phase: Phase, targets: Target[]) =>
  sha256(JSON.stringify([phase, targets.map((t) => [t.id, t.name])]))

const load = async (c: Context<PlayerEnv>) => {
  const db = createDb(c.env.DB)
  const [phase, targets] = await Promise.all([getPhase(db), listTargets(db, c.var.player.id)])
  return { phase, targets }
}

accusations.get('/accuse', async (c) => {
  const { phase, targets } = await load(c)
  const content = loadContent(c.env.CONTENT_SET)
  const open = phaseAllows(phase, 'accuse')
  const guessed = targets.filter((t) => t.guess !== null).length
  return c.render(
    <>
      <hgroup>
        <h1>Accusations</h1>
        <p>{INTRO[phase]}</p>
      </hgroup>
      <Notice done={c.req.query('done')} />
      {phase === 'lobby' ? null : targets.length === 0 ? (
        <p>Nobody else has joined yet.</p>
      ) : (
        <section>
          <p>
            You have a guess for {guessed} of {targets.length}{' '}
            {targets.length === 1 ? 'player' : 'players'}.
          </p>
          {open ? (
            targets.map((t) => <GuessForm target={t} content={content} />)
          ) : (
            <ul>
              {targets.map((t) => (
                <GuessRow target={t} content={content} />
              ))}
            </ul>
          )}
        </section>
      )}
      <a href="/play" role="button" class="secondary outline">
        Back to my challenge
      </a>
      {phase === 'reveal' ? null : (
        // Reloads the page when the phase or the players change (the host
        // opening or closing accusations, a late joiner, a removed player);
        // otherwise the poll gets an empty 204 and does nothing.
        <div
          hx-get={`/accuse/poll?v=${await fingerprint(phase, targets)}`}
          hx-trigger="every 10s"
          hx-swap="none"
        />
      )}
    </>,
    { title: 'Accusations' },
  )
})

accusations.get('/accuse/poll', async (c) => {
  const { phase, targets } = await load(c)
  if (c.req.query('v') === (await fingerprint(phase, targets))) return c.body(null, 204)
  c.header('HX-Refresh', 'true')
  return c.body(null, 200)
})

// A guess: the accused player's id and a challenge number, or an empty
// challenge to clear the guess.
const guessSchema = z.object({
  accused: z.coerce.number().int().positive(),
  challenge: z.union([
    z.literal('').transform(() => null),
    z.coerce.number().int().min(1).max(CONTENT_SIZE),
  ]),
})

// Sends the phone back to the screen: a redirect for a plain form post, or an
// `HX-Redirect` for htmx, which then loads the whole page.
const backToScreen = (c: Context, done?: NoticeKey) => {
  const url = done ? `/accuse?done=${done}` : '/accuse'
  if (c.req.header('HX-Request')) {
    c.header('HX-Redirect', url)
    return c.body(null, 200)
  }
  return c.redirect(url, 303)
}

accusations.post(
  '/accuse',
  zValidator('form', guessSchema, (result, c) => {
    // A tampered form; the screen's own forms can't send one.
    if (!result.success) return backToScreen(c)
  }),
  async (c) => {
    const { accused, challenge } = c.req.valid('form')
    const db = createDb(c.env.DB)
    const result = await setGuess(db, c.var.player.id, accused, challenge)
    if (result === 'self') return backToScreen(c)
    if (result !== 'saved') return backToScreen(c, result)
    if (!c.req.header('HX-Request')) return backToScreen(c, challenge === null ? 'cleared' : 'saved')
    const target = (await listTargets(db, c.var.player.id)).find((t) => t.id === accused)
    if (!target) return backToScreen(c, 'gone')
    return c.html(<GuessForm target={target} content={loadContent(c.env.CONTENT_SET)} saved />)
  },
)

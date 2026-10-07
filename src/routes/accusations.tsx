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

// Short messages after a refused save, passed back in the URL as
// `?done=<key>`. A save that worked without JavaScript is shown on its row
// instead (`?saved=<player id>`).
const NOTICES = {
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

// What a row says under its list once a guess is saved.
const savedText = (content: Content, guess: number | null) =>
  guess === null ? 'Guess cleared.' : `Saved: ${getChallenge(content, guess).name}.`

// One player's row while accusations are open. With htmx, picking a challenge
// saves straight away and only the row's status line is replaced, so the list
// stays as the player left it and a quick second pick is sent after the first
// (htmx queues it on the same form). Without JavaScript, the Save button posts
// the form and the page reloads.
//
// While a save is being sent the status line says so, and if it never arrives
// (no signal, a server error) it says it wasn't saved, so a stale "Saved:"
// line never sits under a different pick.
const statusScript = (text: string) =>
  `this.querySelector('[role=status]').textContent = ${JSON.stringify(text)}`
const NOT_SAVED = 'Not saved. Check your signal and pick again.'
// A save that hangs on a bad signal gives up after 15 seconds and says so,
// rather than showing "Saving…" (and pausing the poll) for as long as it hangs.
const SAVE_TIMEOUT_MS = 15_000
const statusHandlers = {
  'hx-request': JSON.stringify({ timeout: SAVE_TIMEOUT_MS }),
  'hx-on::before-request': statusScript('Saving…'),
  'hx-on::send-error': statusScript(NOT_SAVED),
  'hx-on::response-error': statusScript(NOT_SAVED),
  'hx-on::timeout': statusScript(NOT_SAVED),
}

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
    hx-target={`#status-${target.id}`}
    hx-swap="innerHTML"
    {...statusHandlers}
  >
    <input type="hidden" name="accused" value={String(target.id)} />
    <label for={`guess-${target.id}`}>
      <strong>{target.name}</strong>
    </label>
    <fieldset role="group">
      {/* `autocomplete="off"`, so the Back button shows the saved guess, not a
          pick that failed to save. */}
      <select id={`guess-${target.id}`} name="challenge" autocomplete="off">
        <ChallengeOptions content={content} guess={target.guess} />
      </select>
      <button type="submit" class="secondary">
        Save
      </button>
    </fieldset>
    <small id={`status-${target.id}`} role="status">
      {saved ? savedText(content, target.guess) : null}
    </small>
  </form>
)

const GuessCount = ({ targets, oob }: { targets: Target[]; oob?: boolean }) => (
  <p id="guess-count" hx-swap-oob={oob ? 'true' : undefined}>
    You have a guess for {targets.filter((t) => t.guess !== null).length} of {targets.length}{' '}
    {targets.length === 1 ? 'player' : 'players'}.
  </p>
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
    'Pick the challenge you think each player has. You can change or clear a guess until the host closes accusations. Nobody finds out whether a guess is right, or who guessed what, until the reveal.',
  accusations_closed: 'Accusations are closed. These are your final guesses.',
  reveal: 'Accusations are closed. These were your final guesses.',
}

// A fingerprint of what the 10-second poll watches: the phase and, once the
// game is on, the other players. Not the player's own guesses, or every save
// would reload the page a few seconds later; not the players in the Lobby,
// where the screen doesn't list them. Hashed only to keep the URL short.
const fingerprint = (phase: Phase, targets: Target[]) =>
  sha256(JSON.stringify([phase, targets.map((t) => [t.id, t.name])]))

// The phase and, outside the Lobby, the other players with this player's own
// guesses.
const load = async (c: Context<PlayerEnv>) => {
  const db = createDb(c.env.DB)
  const phase = await getPhase(db)
  const targets = phase === 'lobby' ? [] : await listTargets(db, c.var.player.id)
  return { phase, targets }
}

accusations.get('/accuse', async (c) => {
  const { phase, targets } = await load(c)
  const content = loadContent(c.env.CONTENT_SET)
  const open = phaseAllows(phase, 'accuse')
  const savedRow = Number(c.req.query('saved'))
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
          <GuessCount targets={targets} />
          {open ? (
            targets.map((t) => (
              <GuessForm target={t} content={content} saved={t.id === savedRow} />
            ))
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
        // Reloads the screen when the phase or the players change (the host
        // opening or closing accusations, a late joiner, a removed player);
        // otherwise the poll gets an empty 204 and does nothing.
        // It skips a tick while a save is being sent, so a reload can't cut
        // the save off.
        <div
          hx-get={`/accuse/poll?v=${await fingerprint(phase, targets)}`}
          hx-trigger="every 10s [!document.querySelector('.htmx-request')]"
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
  // A fresh `/accuse`, not a reload, so an old `?done=` notice isn't shown again.
  c.header('HX-Redirect', '/accuse')
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
    // Without JavaScript: back to the same row, which says what was saved.
    if (!c.req.header('HX-Request')) return c.redirect(`/accuse?saved=${accused}#player-${accused}`, 303)
    // The row's status line, and the count above the list, updated out of band.
    const targets = await listTargets(db, c.var.player.id)
    return c.html(
      <>
        {savedText(loadContent(c.env.CONTENT_SET), challenge)}
        <GuessCount targets={targets} oob />
      </>,
    )
  },
)

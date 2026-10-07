import { zValidator } from '@hono/zod-validator'
import { type Context, Hono } from 'hono'
import { raw } from 'hono/html'
import { z } from 'zod'
import { type PlayerEnv, requirePlayer } from '../auth/session'
import { type Content, getChallenge, getDecoy, loadContent } from '../content'
import { createDb } from '../db/client'
import { getPhase } from '../db/game'
import { setOwnCompletion } from '../db/play'
import type { Player } from '../db/schema'
import { PHASE_LABELS, type Phase, phaseAllows } from '../game/phases'

// The player screen (docs/scope.md, "Player screen"): the player's own
// challenge, decoy and completion status, the "I've done it" button and its
// undo, and the hint list. It never shows anything about another player
// (CLAUDE.md rule 2). Accusations (unit 3.03, /accuse) and the reveal (unit
// 3.05, /reveal) have their own screens, linked from here.
export const play = new Hono<PlayerEnv>()

// `/play/*` also matches `/play` itself.
play.use('/play/*', requirePlayer, async (c, next) => {
  await next()
  // The page shows the player's secret challenge: keep it out of every cache,
  // including the back button after logging out on a shared phone.
  c.header('Cache-Control', 'no-store')
})

type Notice = 'refused'

// What the status section shows changes only with these. The 10-second poll
// sends the key it last saw and gets "204 No Content" (which htmx doesn't
// swap) while it still matches, so an unchanged screen isn't redrawn. A
// section showing a notice has a key no poll matches, so the next poll clears
// the notice.
const stateKey = (phase: Phase, player: Player, notice?: Notice) =>
  `${phase}-${player.challenge === null ? 0 : 1}-${player.completed ? 1 : 0}${notice ? `-${notice}` : ''}`

const Completion = ({ phase, completed }: { phase: Phase; completed: boolean }) => (
  <footer>
    <p>
      {completed ? <strong>✓ You've marked it done.</strong> : <strong>Not done yet.</strong>}
    </p>
    {phaseAllows(phase, 'markOwnCompletion') ? (
      // Sends the state wanted rather than a toggle, so a double tap is harmless.
      <form method="post" action="/play/done" hx-post="/play/done" hx-target="#status" hx-swap="outerHTML">
        <input type="hidden" name="completed" value={completed ? 'false' : 'true'} />
        {completed ? (
          <button type="submit" class="secondary outline">
            Undo: I haven't done it
          </button>
        ) : (
          <button type="submit">I've done it</button>
        )}
      </form>
    ) : phase === 'accusations_closed' ? (
      <p>
        <small>This is frozen now. If it's wrong, tell the host, who can still fix it.</small>
      </p>
    ) : null}
  </footer>
)

// The player's own challenge and decoy, with descriptions.
const Secrets = ({
  phase,
  completed,
  challenge,
  decoy,
  content,
}: {
  phase: Phase
  completed: boolean
  challenge: number
  decoy: number
  content: Content
}) => {
  const { name, description } = getChallenge(content, challenge)
  const theDecoy = getDecoy(content, decoy)
  return (
    <>
      <article>
        <header>Your secret challenge</header>
        <h3>{name}</h3>
        <p>{description}</p>
        <Completion phase={phase} completed={completed} />
      </article>
      <article>
        <header>Your decoy (optional)</header>
        <h3>{theDecoy.name}</h3>
        <p>{theDecoy.description}</p>
        <footer>
          <small>Use it to throw others off your scent. It doesn't affect your score.</small>
        </footer>
      </article>
    </>
  )
}

const Status = ({
  phase,
  player,
  content,
  notice,
}: {
  phase: Phase
  player: Player
  content: Content
  notice?: Notice | undefined
}) => (
  <section
    id="status"
    hx-get={`/play/status?seen=${stateKey(phase, player, notice)}`}
    hx-trigger="every 10s"
    hx-swap="outerHTML"
  >
    <p>
      Phase: <strong>{PHASE_LABELS[phase]}</strong>
    </p>
    {notice === 'refused' ? (
      <article role="status">
        <strong>That wasn't saved: you can only mark your challenge done while the game is on.</strong>
      </article>
    ) : null}
    {phase === 'lobby' ? (
      <p>
        You're in the lobby. Your secret challenge and decoy appear here when the game starts. In the meantime, have a
        look at the hints below.
      </p>
    ) : player.challenge === null || player.decoy === null ? (
      <p>
        {phase === 'game_on'
          ? 'Your challenge is on its way. This screen checks again every few seconds.'
          : "You weren't given a challenge before accusations closed, so you have nothing to complete."}
      </p>
    ) : (
      <Secrets phase={phase} completed={player.completed} challenge={player.challenge} decoy={player.decoy} content={content} />
    )}
    {/* Links to the accusation (3.03) and reveal (3.05) screens. */}
    {phase === 'game_on' ? (
      <a href="/accuse" role="button" class="secondary" style="width: 100%">
        Make an accusation
      </a>
    ) : phase === 'accusations_closed' ? (
      <>
        <p>Accusations are closed. Waiting for the host to reveal the results.</p>
        <a href="/accuse" role="button" class="secondary outline" style="width: 100%">
          See your accusations
        </a>
      </>
    ) : phase === 'reveal' ? (
      <a href="/reveal" role="button" style="width: 100%">
        See the results
      </a>
    ) : null}
  </section>
)

// All 20 challenge names, each with its hint, from the start. Full challenge
// descriptions only come at the reveal (docs/scope.md, "Player screen").
const Hints = ({ content }: { content: Content }) => (
  <section>
    <h2>Hints</h2>
    <p>Every challenge in the game, with a hint for spotting someone doing it.</p>
    <dl>
      {content.challenges.map((challenge) => (
        <>
          <dt>
            <strong>{challenge.name}</strong>
          </dt>
          <dd>{challenge.hint}</dd>
        </>
      ))}
    </dl>
  </section>
)

play.get('/play', async (c) => {
  const player = c.var.player
  const phase = await getPhase(createDb(c.env.DB))
  const content = loadContent(c.env.CONTENT_SET)
  const notice = c.req.query('done') === 'refused' ? 'refused' : undefined
  return c.render(
    <>
      <hgroup>
        <h1>{player.name}</h1>
        <p>Chess pub crawl</p>
      </hgroup>
      <Status phase={phase} player={player} content={content} notice={notice} />
      <Hints content={content} />
      <form method="post" action="/logout">
        <button type="submit" class="secondary outline">
          Not {player.name}? Log out
        </button>
      </form>
      {/* Some phone browsers keep a page in memory despite no-store and show
          it again on Back, after logging out on a borrowed phone. Reload it
          instead, which sends a logged-out phone to the join page. */}
      <script>{raw("addEventListener('pageshow', (e) => { if (e.persisted) location.reload() })")}</script>
    </>,
    { title: 'Chess pub crawl' },
  )
})

// The 10-second poll: the status section again, or 204 if nothing it shows
// has changed.
play.get('/play/status', async (c) => {
  const player = c.var.player
  const phase = await getPhase(createDb(c.env.DB))
  if (c.req.query('seen') === stateKey(phase, player)) return c.body(null, 204)
  return c.html(<Status phase={phase} player={player} content={loadContent(c.env.CONTENT_SET)} />)
})

// After a tap on "I've done it" or its undo: htmx gets the status section to
// swap in; a plain form post (htmx not loaded yet) goes back to the screen.
const afterCompletion = async (c: Context<PlayerEnv>, player: Player, notice?: Notice) => {
  if (!c.req.header('HX-Request')) return c.redirect(notice ? `/play?done=${notice}` : '/play', 303)
  const phase = await getPhase(createDb(c.env.DB))
  return c.html(
    <Status phase={phase} player={player} content={loadContent(c.env.CONTENT_SET)} notice={notice} />,
  )
}

play.post(
  '/play/done',
  // Only a tampered form fails this; the screen's own buttons always pass.
  // Nothing changes: htmx gets nothing to swap, a plain post the screen.
  zValidator('form', z.object({ completed: z.enum(['true', 'false']) }), (r, c) => {
    if (!r.success) return c.req.header('HX-Request') ? c.body(null, 204) : c.redirect('/play', 303)
  }),
  async (c) => {
    const player = c.var.player
    const completed = c.req.valid('form').completed === 'true'
    // setOwnCompletion checks the phase as it writes.
    const saved = await setOwnCompletion(createDb(c.env.DB), player.id, completed)
    return saved ? afterCompletion(c, { ...player, completed }) : afterCompletion(c, player, 'refused')
  },
)

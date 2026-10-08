import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { type PlayerEnv, requirePlayer } from '../auth/session'
import { type Content, getChallenge, getDecoy, loadContent } from '../content'
import { createDb } from '../db/client'
import { getPhase } from '../db/game'
import { type FinalGame, loadFinalGame } from '../db/reveal'
import { phaseAllows } from '../game/phases'
import { type AccusationResult, type PlayerScore, POINTS, scoreGame } from '../game/scoring'

// The reveal (docs/scope.md, "Reveal"): the final leaderboard and every
// player's breakdown, with full challenge descriptions. Only in the Reveal
// phase; before then it sends the phone back to the player screen and reads
// nothing about anyone. It doesn't poll: the Reveal is the last phase, and
// completions are final by then. The host page shows the same results at
// `/host/results` (unit 3.07), through `Results` below.
export const reveal = new Hono<PlayerEnv>()

reveal.use('/reveal', requirePlayer)

// With a typographic minus, so negative numbers read the same everywhere.
const number = (n: number) => (n < 0 ? `−${-n}` : `${n}`)
const signed = (n: number) => (n > 0 ? `+${n}` : number(n))
const points = (n: number) => `${number(n)} ${Math.abs(n) === 1 ? 'point' : 'points'}`

// `=1` for a rank shared with someone else.
const rankLabeller = (scores: PlayerScore[]) => {
  const counts = new Map<number, number>()
  for (const s of scores) counts.set(s.rank, (counts.get(s.rank) ?? 0) + 1)
  return (s: PlayerScore) => (counts.get(s.rank)! > 1 ? `=${s.rank}` : `${s.rank}`)
}

// Why a player got their challenge points, worked out from the points
// themselves so it can't disagree with them.
const challengeReason = (s: PlayerScore) =>
  s.challenge === null
    ? 'never got a challenge'
    : s.challengePoints === POINTS.completedUndetected
      ? 'completed and not detected'
      : s.challengePoints === POINTS.completedDetected
        ? 'completed but detected'
        : 'not completed'

// The link to a player's breakdown reloads the page with it open, because
// following a link to a closed <details> doesn't open it. `path` is the page
// the results are on: `/reveal` for players, `/host/results` for the host.
const breakdownLink = (path: string, id: number) => `${path}?show=${id}#player-${id}`

type Labels = (s: PlayerScore) => string

// `you` is the phone's own player, or undefined on the host's copy.
const Leaderboard = ({
  scores,
  you,
  rank,
  path,
}: {
  scores: PlayerScore[]
  you: number | undefined
  rank: Labels
  path: string
}) => (
  <section>
    <h2>Leaderboard</h2>
    <div class="overflow-auto">
      <table>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Player</th>
            <th scope="col">Points</th>
          </tr>
        </thead>
        <tbody>
          {scores.map((s) => {
            const name = <a href={breakdownLink(path, s.id)}>{s.name}</a>
            return (
              <tr aria-current={s.id === you ? 'true' : undefined}>
                <td>{rank(s)}</td>
                <td>{s.id === you ? <strong>{name} (you)</strong> : name}</td>
                <td>{s.id === you ? <strong>{number(s.total)}</strong> : number(s.total)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    <details>
      <summary>How points work</summary>
      <ul>
        <li>Completed your challenge and nobody guessed it: {signed(POINTS.completedUndetected)}</li>
        <li>Completed it, but someone guessed it: {signed(POINTS.completedDetected)}</li>
        <li>Didn't complete it: {signed(POINTS.notCompleted)}</li>
        <li>Each correct accusation: {signed(POINTS.correctAccusation)}</li>
        <li>Each wrong accusation: {signed(POINTS.wrongAccusation)}</li>
      </ul>
      <p>The decoy is worth nothing. Tied players share a rank.</p>
    </details>
  </section>
)

const Accusations = ({
  title,
  list,
  each,
  content,
}: {
  title: string
  list: AccusationResult[]
  each: number
  content: Content
}) => (
  <>
    <p>
      <strong>
        {title} ({signed(list.length * each)}):
      </strong>
      {list.length === 0 ? ' none' : null}
    </p>
    {list.length > 0 && (
      <ul>
        {list.map((a) => {
          const guessed = getChallenge(content, a.guessed).name
          const what =
            a.guessed === a.actual ? guessed : `guessed ${guessed}, it was ${getChallenge(content, a.actual).name}`
          return (
            <li>
              {a.accusedName}: {what} ({signed(each)})
            </li>
          )
        })}
      </ul>
    )}
  </>
)

const Breakdown = ({
  score: s,
  you,
  open,
  rank,
  content,
}: {
  score: PlayerScore
  you: number | undefined
  open: boolean
  rank: Labels
  content: Content
}) => {
  const challenge = s.challenge === null ? undefined : getChallenge(content, s.challenge)
  const decoy = s.decoy === null ? undefined : getDecoy(content, s.decoy)
  return (
    <article id={`player-${s.id}`} class="breakdown">
      <details open={open} style="margin-bottom: 0">
        <summary>
          {rank(s)}. {s.name}
          {s.id === you ? ' (you)' : ''}: {points(s.total)}
        </summary>
        {challenge ? (
          <p>
            <strong>Challenge: {challenge.name}</strong>
            <br />
            {challenge.description}
          </p>
        ) : (
          <p>Never got a challenge.</p>
        )}
        {decoy ? (
          <p>
            <strong>Decoy: {decoy.name}</strong>
            <br />
            {decoy.description}
          </p>
        ) : (
          <p>Never got a decoy.</p>
        )}
        {challenge && (
          <ul>
            <li>Completed: {s.completed ? 'Yes' : 'No'}</li>
            <li>Detected by: {s.detectedBy.length === 0 ? 'Nobody' : s.detectedBy.map((d) => d.name).join(', ')}</li>
          </ul>
        )}
        <p>
          <strong>Challenge points ({signed(s.challengePoints)}):</strong> {challengeReason(s)}
        </p>
        <Accusations
          title="Right accusations"
          list={s.correctAccusations}
          each={POINTS.correctAccusation}
          content={content}
        />
        <Accusations
          title="Wrong accusations"
          list={s.wrongAccusations}
          each={POINTS.wrongAccusation}
          content={content}
        />
        <p style="margin-bottom: 0">
          <strong>Total: {points(s.total)}</strong>
        </p>
      </details>
    </article>
  )
}

// `?show=<id>` opens that player's breakdown too (the leaderboard's links).
// Anything else in it is ignored.
export const showQuery = zValidator(
  'query',
  z.object({ show: z.coerce.number().int().positive().optional().catch(undefined) }),
)

// The heading, leaderboard and everyone's breakdown, scored from `game`
// (`loadFinalGame`), shared by the players' `/reveal` and the host's
// `/host/results`. `you` (the phone's own player) is marked and opened; the
// host's copy has no `you`. `show` opens one more breakdown.
export const Results = ({
  game,
  content,
  you,
  show,
  path,
}: {
  game: FinalGame
  content: Content
  you: number | undefined
  show: number | undefined
  path: string
}) => {
  const scores = scoreGame(game.players, game.accusations)
  const rank = rankLabeller(scores)
  return (
    <>
      <hgroup>
        <h1>Final results</h1>
        <p>Everyone's challenge, decoy and score.</p>
      </hgroup>
      <Leaderboard scores={scores} you={you} rank={rank} path={path} />
      <section>
        {/* Pico gives a summary a 1rem line height, so the padding makes the
            whole card the tap target, and the gap keeps an open card's first
            line clear of its summary. */}
        <style>
          {'.breakdown summary { padding: 0.75rem 0; margin: -0.75rem 0; } ' +
            '.breakdown details[open] summary { margin-bottom: 0.75rem; }'}
        </style>
        <h2>Everyone's breakdown</h2>
        {scores.map((s) => (
          <Breakdown score={s} you={you} open={s.id === you || s.id === show} rank={rank} content={content} />
        ))}
      </section>
    </>
  )
}

reveal.get('/reveal', showQuery, async (c) => {
  const db = createDb(c.env.DB)
  if (!phaseAllows(await getPhase(db), 'seeReveal')) {
    if (c.req.header('HX-Request')) {
      c.header('HX-Redirect', '/play')
      return c.body(null, 200)
    }
    return c.redirect('/play', 303)
  }
  // The game is over and nothing can change any more, so the scores are read
  // once the phase says so.
  const game = await loadFinalGame(db)
  return c.render(
    <>
      <Results
        game={game}
        content={loadContent(c.env.CONTENT_SET)}
        you={c.var.player.id}
        show={c.req.valid('query').show}
        path="/reveal"
      />
      <p>
        <a href="/play" role="button" class="secondary outline">
          Back to your screen
        </a>
      </p>
    </>,
    { title: 'Final results' },
  )
})

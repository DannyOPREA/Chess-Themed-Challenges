import { Hono } from 'hono'
import { type PlayerEnv, requirePlayer } from '../auth/session'
import { type Content, getChallenge, getDecoy, loadContent } from '../content'
import { createDb } from '../db/client'
import { loadReveal } from '../db/reveal'
import { phaseAllows } from '../game/phases'
import { type AccusationResult, type PlayerScore, POINTS, scoreGame } from '../game/scoring'

// The reveal (docs/scope.md, "Reveal"): the final leaderboard and every
// player's breakdown, with full challenge descriptions. Only in the Reveal
// phase; before then it sends the phone back to the player screen and sends
// nothing about anyone. It doesn't poll: the Reveal is the last phase, and
// completions are final by then.
export const reveal = new Hono<PlayerEnv>()

reveal.use('/reveal', requirePlayer)

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

const points = (n: number) => `${n} ${Math.abs(n) === 1 ? 'point' : 'points'}`

// `=1` for a rank shared with someone else.
const rankLabel = (score: PlayerScore, all: PlayerScore[]) =>
  all.some((s) => s !== score && s.rank === score.rank) ? `=${score.rank}` : `${score.rank}`

const challengeReason = (s: PlayerScore) =>
  s.challenge === null
    ? 'never got a challenge'
    : !s.completed
      ? 'not completed'
      : s.detected
        ? 'completed but detected'
        : 'completed and not detected'

const Leaderboard = ({ scores, you }: { scores: PlayerScore[]; you: number }) => (
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
            const name = <a href={`#player-${s.id}`}>{s.name}</a>
            return (
              <tr aria-current={s.id === you ? 'true' : undefined}>
                <td>{rankLabel(s, scores)}</td>
                <td>
                  {s.id === you ? (
                    <strong>
                      {name} (you)
                    </strong>
                  ) : (
                    name
                  )}
                </td>
                <td>{s.id === you ? <strong>{s.total}</strong> : s.total}</td>
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
  correct,
}: {
  title: string
  list: AccusationResult[]
  each: number
  content: Content
  correct: boolean
}) => (
  <>
    <h4>
      {title} ({signed(list.length * each)})
    </h4>
    {list.length === 0 ? (
      <p>None.</p>
    ) : (
      <ul>
        {list.map((a) => (
          <li>
            {a.accusedName}:{' '}
            {correct ? (
              getChallenge(content, a.guessed).name
            ) : (
              <>
                guessed {getChallenge(content, a.guessed).name}, it was {getChallenge(content, a.actual).name}
              </>
            )}{' '}
            ({signed(each)})
          </li>
        ))}
      </ul>
    )}
  </>
)

const Breakdown = ({
  score: s,
  all,
  you,
  content,
}: {
  score: PlayerScore
  all: PlayerScore[]
  you: number
  content: Content
}) => {
  const challenge = s.challenge === null ? undefined : getChallenge(content, s.challenge)
  const decoy = s.decoy === null ? undefined : getDecoy(content, s.decoy)
  return (
    <details id={`player-${s.id}`} open={s.id === you}>
      <summary>
        {rankLabel(s, all)}. {s.name}
        {s.id === you ? ' (you)' : ''}: {points(s.total)}
      </summary>
      <h3>Challenge</h3>
      {challenge ? (
        <p>
          <strong>{challenge.name}</strong>
          <br />
          {challenge.description}
        </p>
      ) : (
        <p>Never got a challenge.</p>
      )}
      <h3>Decoy</h3>
      {decoy ? (
        <p>
          <strong>{decoy.name}</strong>
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
        Challenge points: <strong>{signed(s.challengePoints)}</strong> ({challengeReason(s)})
      </p>
      <h3>Accusations</h3>
      <Accusations
        title="Right"
        list={s.correctAccusations}
        each={POINTS.correctAccusation}
        content={content}
        correct
      />
      <Accusations
        title="Wrong"
        list={s.wrongAccusations}
        each={POINTS.wrongAccusation}
        content={content}
        correct={false}
      />
      <p>
        <strong>Total: {points(s.total)}</strong>
      </p>
    </details>
  )
}

reveal.get('/reveal', async (c) => {
  const game = await loadReveal(createDb(c.env.DB))
  if (!phaseAllows(game.phase, 'seeReveal')) {
    if (c.req.header('HX-Request')) {
      c.header('HX-Redirect', '/play')
      return c.body(null, 200)
    }
    return c.redirect('/play', 303)
  }
  const content = loadContent(c.env.CONTENT_SET)
  const scores = scoreGame(game.players, game.accusations)
  const you = c.var.player.id
  return c.render(
    <>
      <hgroup>
        <h1>Final results</h1>
        <p>Everyone's challenge, decoy and score.</p>
      </hgroup>
      {scores.length === 0 ? (
        <p>Nobody played.</p>
      ) : (
        <>
          <Leaderboard scores={scores} you={you} />
          <section>
            <h2>Everyone's breakdown</h2>
            {scores.map((s) => (
              <Breakdown score={s} all={scores} you={you} content={content} />
            ))}
          </section>
        </>
      )}
    </>,
    { title: 'Final results' },
  )
})

import { Hono } from 'hono'
import { type PlayerEnv, requirePlayer } from '../auth/session'
import { getChallenge, getDecoy, loadContent } from '../content'
import { createDb } from '../db/client'
import { getPhase } from '../db/game'
import { PHASE_LABELS } from '../game/phases'

// Where players land after joining or rejoining. A placeholder until the
// player screen (unit 3.02) replaces this file: it shows only the player's own
// name, the phase, and their own challenge and decoy names once assigned.
export const play = new Hono<PlayerEnv>()

play.use('/play', requirePlayer)

play.get('/play', async (c) => {
  const player = c.var.player
  const phase = await getPhase(createDb(c.env.DB))
  const content = loadContent(c.env.CONTENT_SET)
  return c.render(
    <>
      <hgroup>
        <h1>You're in, {player.name}</h1>
        <p>Phase: {PHASE_LABELS[phase]}</p>
      </hgroup>
      {player.challenge !== null && player.decoy !== null ? (
        <>
          <p>
            Your challenge: <strong>{getChallenge(content, player.challenge).name}</strong>
          </p>
          <p>
            Your decoy: <strong>{getDecoy(content, player.decoy).name}</strong>
          </p>
        </>
      ) : (
        <p>Your challenge and decoy appear here when the game starts.</p>
      )}
      <form method="post" action="/logout">
        <button type="submit" class="secondary outline">
          Not {player.name}? Log out
        </button>
      </form>
    </>,
    { title: 'Chess pub crawl' },
  )
})

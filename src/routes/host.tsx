import { zValidator } from '@hono/zod-validator'
import { type Context, Hono } from 'hono'
import { basicAuth } from 'hono/basic-auth'
import { raw } from 'hono/html'
import { timingSafeEqual } from 'hono/utils/buffer'
import { renderSVG } from 'uqr'
import { z } from 'zod'
import { getChallenge, getDecoy, loadContent } from '../content'
import { createDb } from '../db/client'
import { getPhase } from '../db/game'
import {
  changePhase,
  getPlayer,
  listPlayers,
  listPlayersWithSecrets,
  removePlayer,
  resetPin,
  setCompletion,
} from '../db/host'
import type { AppEnv } from '../env'
import { PHASE_LABELS, type Phase, phaseAllows, phaseChangesFrom, phaseSchema } from '../game/phases'

// The host page (docs/scope.md, "Host page"), behind HTTP basic auth with the
// HOST_PASSWORD secret. Danny also plays, so nothing here shows a challenge or
// decoy except the emergency "show all" page, and completions are only shown
// on each player's own page, not in the list. Every action that can't be
// undone (a phase change, removing a player, show all) has a confirm step.
export const host = new Hono<AppEnv>()

host.use('/host', ...hostGuards())
host.use('/host/*', ...hostGuards())

function hostGuards() {
  return [
    basicAuth({
      realm: 'Chess pub crawl host',
      // Any user name; only the password counts, so there's one less thing to
      // remember on the night. An unset password locks the page rather than
      // opening it.
      verifyUser: async (_user, password, c: Context<AppEnv>) => {
        const expected = c.env.HOST_PASSWORD
        return !!expected && (await timingSafeEqual(password, expected))
      },
    }),
    // Host pages can show completions, or with "show all" everything, so keep
    // them out of every cache, including the phone's back button.
    async (c: Context<AppEnv>, next: () => Promise<void>) => {
      await next()
      c.header('Cache-Control', 'no-store')
    },
  ] as const
}

// Short messages after an action, passed back in the URL as `?done=<key>`.
const NOTICES = {
  phase: 'Phase changed.',
  'phase-stale': 'The phase had already changed, so nothing was done. Here is where the game is now.',
  removed: 'Player removed.',
  gone: 'That player has been removed.',
  pin: 'New PIN saved. Tell the player their new PIN.',
  completion: 'Completion saved.',
  'completion-refused': "Completions can't be changed right now.",
} as const
type NoticeKey = keyof typeof NOTICES

const Notice = ({ done }: { done: string | undefined }) =>
  done && done in NOTICES ? <p role="status">{NOTICES[done as NoticeKey]}</p> : null

const idParam = zValidator('param', z.object({ id: z.coerce.number().int().positive() }), (result, c) => {
  if (!result.success) return c.notFound()
})

// A bad form (a PIN that isn't 4 digits, a tampered phase) goes back to the
// page it came from with nothing changed; the forms themselves stop it first.
const badForm = (c: Context) => c.redirect(c.req.path.replace(/\/[^/]+$/, '') || '/host', 303)

const NEXT_PHASE_TEXT: Partial<Record<Phase, string>> = {
  game_on:
    'Every player in the lobby gets their challenge and decoy now, and players can start. People can still join late.',
  accusations_closed:
    'Players can no longer mark their challenge done or change accusations. You can still fix completions.',
  reveal: 'Everyone sees the final leaderboard and every challenge and decoy. Completions are final.',
}

// ---- Main page ----

const PlayerList = ({ list, phase }: { list: Awaited<ReturnType<typeof listPlayers>>; phase: Phase }) => (
  <section id="players" hx-get="/host/players" hx-trigger="every 10s" hx-swap="outerHTML">
    <h2>Players ({list.length})</h2>
    {list.length === 0 ? (
      <p>Nobody has joined yet.</p>
    ) : (
      <ul>
        {list.map((p) => (
          <li>
            <a href={`/host/players/${p.id}`}>{p.name}</a>
            {phase !== 'lobby' && !p.assigned ? <small> (no challenge yet)</small> : null}
          </li>
        ))}
      </ul>
    )}
  </section>
)

host.get('/host', async (c) => {
  const db = createDb(c.env.DB)
  const [phase, list] = await Promise.all([getPhase(db), listPlayers(db)])
  const next = phaseChangesFrom(phase)[0]
  return c.render(
    <>
      <h1>Host</h1>
      <Notice done={c.req.query('done')} />
      <section>
        <h2>Phase: {PHASE_LABELS[phase]}</h2>
        {next ? (
          <a href={`/host/phase?to=${next}`} role="button">
            Move to {PHASE_LABELS[next]}
          </a>
        ) : (
          <p>The game is over. This is the final phase.</p>
        )}
      </section>
      <PlayerList list={list} phase={phase} />
      <section>
        <h2>Join code</h2>
        <a href="/host/qr" role="button" class="secondary">
          Show the join QR code
        </a>
      </section>
      <section>
        <h2>Emergency</h2>
        <a href="/host/all" role="button" class="contrast outline">
          Show all challenges and decoys
        </a>
      </section>
    </>,
    { title: 'Host' },
  )
})

host.get('/host/players', async (c) => {
  const db = createDb(c.env.DB)
  const [phase, list] = await Promise.all([getPhase(db), listPlayers(db)])
  return c.html(<PlayerList list={list} phase={phase} />)
})

// ---- Phase changes ----

host.get('/host/phase', zValidator('query', z.object({ to: phaseSchema }), (r, c) => {
  if (!r.success) return c.redirect('/host', 303)
}), async (c) => {
  const { to } = c.req.valid('query')
  const from = await getPhase(createDb(c.env.DB))
  if (!phaseChangesFrom(from).includes(to)) return c.redirect('/host?done=phase-stale', 303)
  return c.render(
    <>
      <h1>Move to {PHASE_LABELS[to]}?</h1>
      <p>{NEXT_PHASE_TEXT[to]}</p>
      <p>
        <strong>This can't be undone.</strong> The game only moves forward.
      </p>
      <form method="post" action="/host/phase">
        <input type="hidden" name="from" value={from} />
        <input type="hidden" name="to" value={to} />
        <button type="submit">Yes, move to {PHASE_LABELS[to]}</button>
      </form>
      <a href="/host" role="button" class="secondary">
        Cancel
      </a>
    </>,
    { title: `Move to ${PHASE_LABELS[to]}?` },
  )
})

host.post('/host/phase', zValidator('form', z.object({ from: phaseSchema, to: phaseSchema }), (r, c) => {
  if (!r.success) return c.redirect('/host', 303)
}), async (c) => {
  const { from, to } = c.req.valid('form')
  const changed = await changePhase(createDb(c.env.DB), from, to)
  return c.redirect(changed ? '/host?done=phase' : '/host?done=phase-stale', 303)
})

// ---- One player ----

host.get('/host/players/:id', idParam, async (c) => {
  const { id } = c.req.valid('param')
  const db = createDb(c.env.DB)
  const [phase, player] = await Promise.all([getPhase(db), getPlayer(db, id)])
  if (!player) return c.redirect('/host?done=gone', 303)
  const canMark = phaseAllows(phase, 'hostMarkCompletion') && player.assigned
  return c.render(
    <>
      <p>
        <a href="/host">Back to the host page</a>
      </p>
      <h1>{player.name}</h1>
      <Notice done={c.req.query('done')} />
      <section>
        <h2>Challenge done?</h2>
        {!player.assigned ? (
          <p>No challenge yet. Completion can be set once the game is on.</p>
        ) : (
          <p>{player.completed ? 'Marked done.' : 'Not marked done.'}</p>
        )}
        {canMark ? (
          <form method="post" action={`/host/players/${id}/completion`}>
            <input type="hidden" name="completed" value={player.completed ? 'false' : 'true'} />
            <button type="submit" class="secondary">
              {player.completed ? 'Unmark as done' : 'Mark as done'}
            </button>
          </form>
        ) : player.assigned ? (
          <p>
            <small>Completions can only be changed during Game on and Accusations closed.</small>
          </p>
        ) : null}
      </section>
      <section>
        <h2>Reset PIN</h2>
        <p>For a player who has forgotten their PIN. Pick a new one and tell them.</p>
        <form method="post" action={`/host/players/${id}/pin`}>
          <label>
            New 4-digit PIN
            <input
              name="pin"
              inputmode="numeric"
              pattern="[0-9]{4}"
              maxlength={4}
              minlength={4}
              autocomplete="off"
              required
            />
          </label>
          <button type="submit" class="secondary">
            Save new PIN
          </button>
        </form>
      </section>
      <section>
        <h2>Remove</h2>
        <a href={`/host/players/${id}/remove`} role="button" class="contrast outline">
          Remove {player.name}
        </a>
      </section>
    </>,
    { title: player.name },
  )
})

host.post(
  '/host/players/:id/completion',
  idParam,
  zValidator('form', z.object({ completed: z.enum(['true', 'false']) }), (r, c) => {
    if (!r.success) return badForm(c)
  }),
  async (c) => {
    const { id } = c.req.valid('param')
    const completed = c.req.valid('form').completed === 'true'
    const db = createDb(c.env.DB)
    if (!phaseAllows(await getPhase(db), 'hostMarkCompletion')) {
      return c.redirect(`/host/players/${id}?done=completion-refused`, 303)
    }
    const saved = await setCompletion(db, id, completed)
    if (saved) return c.redirect(`/host/players/${id}?done=completion`, 303)
    const exists = await getPlayer(db, id)
    return c.redirect(exists ? `/host/players/${id}?done=completion-refused` : '/host?done=gone', 303)
  },
)

host.post(
  '/host/players/:id/pin',
  idParam,
  zValidator('form', z.object({ pin: z.string().regex(/^\d{4}$/) }), (r, c) => {
    if (!r.success) return badForm(c)
  }),
  async (c) => {
    const { id } = c.req.valid('param')
    const saved = await resetPin(createDb(c.env.DB), id, c.req.valid('form').pin)
    return c.redirect(saved ? `/host/players/${id}?done=pin` : '/host?done=gone', 303)
  },
)

host.get('/host/players/:id/remove', idParam, async (c) => {
  const { id } = c.req.valid('param')
  const player = await getPlayer(createDb(c.env.DB), id)
  if (!player) return c.redirect('/host?done=gone', 303)
  return c.render(
    <>
      <h1>Remove {player.name}?</h1>
      <p>
        Their accusations, and everyone's accusations about them, are deleted, and their challenge and decoy become
        free for new players. They can join again as a new player.
      </p>
      <p>
        <strong>This can't be undone.</strong>
      </p>
      <form method="post" action={`/host/players/${id}/remove`}>
        <button type="submit" class="contrast">
          Yes, remove {player.name}
        </button>
      </form>
      <a href={`/host/players/${id}`} role="button" class="secondary">
        Cancel
      </a>
    </>,
    { title: `Remove ${player.name}?` },
  )
})

host.post('/host/players/:id/remove', idParam, async (c) => {
  const { id } = c.req.valid('param')
  const removed = await removePlayer(createDb(c.env.DB), id)
  return c.redirect(removed ? '/host?done=removed' : '/host?done=gone', 303)
})

// ---- Join QR code ----

host.get('/host/qr', (c) => {
  const joinUrl = new URL('/', c.req.url).href
  return c.render(
    <>
      <p>
        <a href="/host">Back to the host page</a>
      </p>
      <h1>Scan to join</h1>
      <figure style="max-width: 24rem; margin-inline: auto; background: #fff; padding: 0.5rem">
        {raw(renderSVG(joinUrl, { border: 2 }))}
      </figure>
      <p style="text-align: center">
        <a href={joinUrl}>{joinUrl}</a>
      </p>
    </>,
    { title: 'Scan to join' },
  )
})

// ---- Emergency "show all" ----

host.get('/host/all', (c) =>
  c.render(
    <>
      <p>
        <a href="/host">Back to the host page</a>
      </p>
      <h1>Emergency: show all</h1>
      <p>
        <strong>
          This shows every player's challenge and decoy, and who has done theirs. Use it only if something has gone
          wrong, and keep the screen to yourself.
        </strong>
      </p>
      <form method="post" action="/host/all">
        <button type="submit" class="contrast">
          Show everything
        </button>
      </form>
      <a href="/host" role="button" class="secondary">
        Cancel
      </a>
    </>,
    { title: 'Emergency: show all' },
  ),
)

host.post('/host/all', async (c) => {
  const content = loadContent(c.env.CONTENT_SET)
  const list = await listPlayersWithSecrets(createDb(c.env.DB))
  return c.render(
    <>
      <p>
        <a href="/host">Back to the host page</a>
      </p>
      <h1>Everything (emergency)</h1>
      {list.length === 0 ? (
        <p>Nobody has joined yet.</p>
      ) : (
        <div class="overflow-auto">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Challenge</th>
                <th>Decoy</th>
                <th>Done</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr>
                  <td>{p.name}</td>
                  <td>{p.challenge == null ? 'Not yet' : getChallenge(content, p.challenge).name}</td>
                  <td>{p.decoy == null ? 'Not yet' : getDecoy(content, p.decoy).name}</td>
                  <td>{p.completed ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>,
    { title: 'Everything (emergency)' },
  )
})

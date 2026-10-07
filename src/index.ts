import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { secureHeaders } from 'hono/secure-headers'
import type { AppEnv } from './env'
import { layout } from './layout'
import { notFound, onError } from './routes/errors'
import { home } from './routes/home'
import { play } from './routes/play'

const app = new Hono<AppEnv>()

// `same-origin` rather than the default `no-referrer`, because with
// `no-referrer` browsers send `Origin: null` on form posts, and older phones
// without `Sec-Fetch-Site` would then fail the CSRF check below.
app.use(secureHeaders({ referrerPolicy: 'same-origin' }))
// Refuses form posts from other sites, which matters most for the host page,
// where the browser resends the basic auth password on its own. It only checks
// form content types; other sites can't send JSON here at all, because the app
// sends no CORS headers.
app.use(csrf())
app.use(layout)

// Each screen's routes live in their own file under src/routes/ and are
// registered here with one line.
app.route('/', home)
app.route('/', play)

app.notFound(notFound)
app.onError(onError)

export default app

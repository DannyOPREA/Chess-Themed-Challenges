import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { secureHeaders } from 'hono/secure-headers'
import type { AppEnv } from './env'
import { layout } from './layout'
import { home } from './routes/home'

const app = new Hono<AppEnv>()

app.use(secureHeaders())
// Refuses form posts from other sites, which matters most for the host page,
// where the browser resends the basic auth password on its own.
app.use(csrf())
app.use(layout)

// Each screen's routes live in their own file under src/routes/ and are
// registered here with one line.
app.route('/', home)

export default app

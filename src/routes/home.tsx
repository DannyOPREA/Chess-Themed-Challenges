import { Hono } from 'hono'
import type { AppEnv } from '../env'

// Placeholder start page until the join screen (unit 3.01) replaces it.
export const home = new Hono<AppEnv>()

home.get('/', (c) =>
  c.render(
    <>
      <h1>Chess pub crawl</h1>
      <p>The game isn't open yet.</p>
    </>,
    { title: 'Chess pub crawl' },
  ),
)

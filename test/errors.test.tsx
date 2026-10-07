import { Hono } from 'hono'
import { basicAuth } from 'hono/basic-auth'
import { describe, expect, it } from 'vitest'
import type { AppEnv } from '../src/env'
import { layout } from '../src/layout'
import { notFound, onError } from '../src/routes/errors'

// A throwaway app wired like src/index.ts, with routes that fail on purpose.
const app = new Hono<AppEnv>()
app.use(layout)
app.get('/boom', () => {
  throw new Error('secret detail')
})
app.get('/locked', basicAuth({ username: 'host', password: 'pw' }), (c) => c.text('ok'))
app.notFound(notFound)
app.onError(onError)

describe('error pages', () => {
  it('turns an unexpected error into the 500 page without its details', async () => {
    const res = await app.request('/boom')
    expect(res.status).toBe(500)
    const html = await res.text()
    expect(html).toContain('<h1>Something went wrong</h1>')
    expect(html).toContain('href="/"')
    expect(html).not.toContain('secret detail')
  })

  it("passes a middleware's own error response through", async () => {
    const res = await app.request('/locked')
    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toContain('Basic')
  })
})

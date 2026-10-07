import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

describe('start page', () => {
  it('renders the shared layout with Pico CSS and htmx', async () => {
    const res = await exports.default.fetch('https://example.com/')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('<h1>Chess pub crawl</h1>')
    expect(html).toContain('href="/vendor/pico.min.css"')
    expect(html).toContain('src="/vendor/htmx.min.js"')
    expect(html).toContain('name="viewport"')
  })

  it('answers unknown paths with a 404 page that links back to the start', async () => {
    const res = await exports.default.fetch('https://example.com/no-such-page')
    expect(res.status).toBe(404)
    const html = await res.text()
    expect(html).toContain('<h1>Page not found</h1>')
    expect(html).toContain('href="/"')
  })
})

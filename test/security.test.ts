import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

const formPost = (headers: Record<string, string>) =>
  exports.default.fetch('https://example.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: 'a=1',
  })

// No POST route exists yet, so getting past the CSRF check means a 404.
describe('CSRF check on form posts', () => {
  it('lets a post with this site as its Origin through', async () => {
    const res = await formPost({ Origin: 'https://example.com' })
    expect(res.status).toBe(404)
  })

  it('lets a browser post marked same-origin through even with Origin: null', async () => {
    const res = await formPost({ Origin: 'null', 'Sec-Fetch-Site': 'same-origin' })
    expect(res.status).toBe(404)
  })

  it('refuses a post from another site', async () => {
    const res = await formPost({ Origin: 'https://other.example', 'Sec-Fetch-Site': 'cross-site' })
    expect(res.status).toBe(403)
  })

  it('refuses a cross-site post with Origin: null', async () => {
    const res = await formPost({ Origin: 'null', 'Sec-Fetch-Site': 'cross-site' })
    expect(res.status).toBe(403)
  })
})

describe('secure headers', () => {
  it('are sent, with a referrer policy that keeps Origin on form posts', async () => {
    const res = await exports.default.fetch('https://example.com/')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(res.headers.get('Referrer-Policy')).toBe('same-origin')
  })
})

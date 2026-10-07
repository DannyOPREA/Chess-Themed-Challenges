import { exports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

const formPost = (origin: string) =>
  exports.default.fetch('https://example.com/', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'a=1',
  })

describe('shared middleware', () => {
  it('refuses a form post from another site', async () => {
    const res = await formPost('https://other.example')
    expect(res.status).toBe(403)
  })

  it('lets a form post from the same site through', async () => {
    // No POST route exists yet, so getting past the CSRF check means a 404.
    const res = await formPost('https://example.com')
    expect(res.status).toBe(404)
  })

  it('sends the secure headers', async () => {
    const res = await exports.default.fetch('https://example.com/')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
  })
})

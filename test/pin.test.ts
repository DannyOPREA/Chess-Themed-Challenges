import { describe, expect, it } from 'vitest'
import { hashPin, verifyPin } from '../src/auth/pin'

describe('PIN hashing', () => {
  it('stores a salted SHA-256 hash, never the PIN', async () => {
    const { pinHash, pinSalt } = await hashPin('1234')
    expect(pinHash).toMatch(/^[0-9a-f]{64}$/)
    expect(pinSalt).toMatch(/^[0-9a-f]{32}$/)
    expect(pinHash).not.toContain('1234')
  })

  it('uses a fresh salt each time, so the same PIN hashes differently', async () => {
    const a = await hashPin('1234')
    const b = await hashPin('1234')
    expect(a.pinSalt).not.toBe(b.pinSalt)
    expect(a.pinHash).not.toBe(b.pinHash)
  })

  it('accepts the right PIN and refuses any other', async () => {
    const { pinHash, pinSalt } = await hashPin('0042')
    expect(await verifyPin('0042', pinHash, pinSalt)).toBe(true)
    expect(await verifyPin('0043', pinHash, pinSalt)).toBe(false)
    expect(await verifyPin('42', pinHash, pinSalt)).toBe(false)
    expect(await verifyPin('0042', pinHash, `${pinSalt}0`)).toBe(false)
    expect(await verifyPin('0042', 'short', pinSalt)).toBe(false)
  })
})

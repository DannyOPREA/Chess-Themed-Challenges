import { describe, expect, it } from 'vitest'
import { hashPin, pinSchema, verifyPin } from '../src/auth/pin'

describe('PIN hashing', () => {
  it('stores a salted SHA-256 hash and its salt as hex', async () => {
    const { pinHash, pinSalt } = await hashPin('1234')
    expect(pinHash).toMatch(/^[0-9a-f]{64}$/)
    expect(pinSalt).toMatch(/^[0-9a-f]{32}$/)
  })

  it('uses a fresh salt each time, so the same PIN hashes differently', async () => {
    const a = await hashPin('1234')
    const b = await hashPin('1234')
    expect(a.pinSalt).not.toBe(b.pinSalt)
    expect(a.pinHash).not.toBe(b.pinHash)
  })

  it('accepts the right PIN and refuses any other', async () => {
    const stored = await hashPin('0042')
    expect(await verifyPin('0042', stored)).toBe(true)
    expect(await verifyPin('0043', stored)).toBe(false)
    expect(await verifyPin('42', stored)).toBe(false)
    expect(await verifyPin('0042', { ...stored, pinSalt: `${stored.pinSalt}0` })).toBe(false)
    expect(await verifyPin('0042', { ...stored, pinHash: 'short' })).toBe(false)
  })

  it('accepts exactly four digits as a PIN', () => {
    for (const pin of ['0000', '1234', '9999']) expect(pinSchema.safeParse(pin).success).toBe(true)
    for (const pin of ['', '123', '12345', 'abcd', '12 4', ' 1234', '１２３４']) {
      expect(pinSchema.safeParse(pin).success, pin).toBe(false)
    }
  })
})

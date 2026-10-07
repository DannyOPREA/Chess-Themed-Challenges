import { timingSafeEqual } from 'hono/utils/buffer'
import { sha256 } from 'hono/utils/crypto'
import { z } from 'zod'

// Players' 4-digit PINs, stored as a salted SHA-256 hash (CLAUDE.md, "Stack"),
// both as hex in `players.pin_hash` and `players.pin_salt`. Hono's own helpers
// do the hashing (Web Crypto) and the constant-time compare.

/** A PIN as typed: exactly four digits. */
export const pinSchema = z.string().regex(/^\d{4}$/, 'The PIN must be 4 digits')

const digest = async (salt: string, pin: string) => {
  const hash = await sha256(`${salt}:${pin}`)
  if (!hash) throw new Error('Web Crypto is not available')
  return hash
}

/** Hashes a PIN with a fresh random salt, for storing. */
export const hashPin = async (pin: string): Promise<{ pinHash: string; pinSalt: string }> => {
  // A random UUID without its dashes: 32 hex characters, 122 random bits.
  const pinSalt = crypto.randomUUID().replaceAll('-', '')
  return { pinHash: await digest(pinSalt, pin), pinSalt }
}

/** Whether `pin` matches a stored hash and salt. */
export const verifyPin = async (pin: string, stored: { pinHash: string; pinSalt: string }): Promise<boolean> =>
  timingSafeEqual(await digest(stored.pinSalt, pin), stored.pinHash)

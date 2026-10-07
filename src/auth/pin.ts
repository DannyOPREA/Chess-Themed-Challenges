import { z } from 'zod'

// Players choose a 4-digit PIN when they join and use it with their name to
// get back in from another phone (docs/scope.md, "Joining and rejoining"). It
// is stored as a salted SHA-256 hash made with the runtime's Web Crypto
// (CLAUDE.md, "Stack"). There is no lockout after wrong PINs.

export const pinSchema = z.string().regex(/^\d{4}$/, 'Your PIN must be exactly 4 digits.')

export type StoredPin = { pinHash: string; pinSalt: string }

const toHex = (bytes: ArrayBuffer | Uint8Array): string =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')

const digest = async (salt: string, pin: string): Promise<string> =>
  toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`)))

// A fresh random salt for every PIN, so two players with the same PIN get
// different hashes. Both values are hex, for `players.pin_hash` and `pin_salt`.
export const hashPin = async (pin: string): Promise<StoredPin> => {
  const pinSalt = toHex(crypto.getRandomValues(new Uint8Array(16)))
  return { pinHash: await digest(pinSalt, pin), pinSalt }
}

export const verifyPin = async (pin: string, stored: StoredPin): Promise<boolean> => {
  const actual = new TextEncoder().encode(await digest(stored.pinSalt, pin))
  const expected = new TextEncoder().encode(stored.pinHash)
  return actual.byteLength === expected.byteLength && crypto.subtle.timingSafeEqual(actual, expected)
}

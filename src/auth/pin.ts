// Players' 4-digit PINs, stored as a salted SHA-256 hash (CLAUDE.md, "Stack"),
// both as hex in `players.pin_hash` and `players.pin_salt`. Web Crypto only.

const toHex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')

const digest = async (salt: string, pin: string) =>
  toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`)))

/** Hashes a PIN with a fresh random salt, for storing. */
export const hashPin = async (pin: string): Promise<{ pinHash: string; pinSalt: string }> => {
  const pinSalt = toHex(crypto.getRandomValues(new Uint8Array(16)))
  return { pinHash: await digest(pinSalt, pin), pinSalt }
}

/** Whether `pin` matches a stored hash and salt. */
export const verifyPin = async (pin: string, pinHash: string, pinSalt: string): Promise<boolean> => {
  const actual = new TextEncoder().encode(await digest(pinSalt, pin))
  const expected = new TextEncoder().encode(pinHash)
  return actual.length === expected.length && crypto.subtle.timingSafeEqual(actual, expected)
}

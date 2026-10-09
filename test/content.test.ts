import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import {
  CONTENT_SETS,
  CONTENT_SIZE,
  getChallenge,
  getDecoy,
  loadContent,
} from '../src/content'

describe('content loader', () => {
  it('uses the test set in tests, as vitest.config.ts configures', () => {
    expect(env.CONTENT_SET).toBe('test')
    expect(loadContent(env.CONTENT_SET).challenges[0]?.name).toBe('Challenge 1')
  })

  it('picks the set CONTENT_SET names', () => {
    expect(loadContent('test').decoys[0]?.name).toBe('Decoy 1')
    // Only the shape is checked for the real set, so its text stays out of tests.
    expect(loadContent('real').challenges[0]?.name).not.toBe('Challenge 1')
  })

  it('refuses an unknown set rather than guessing', () => {
    expect(() => loadContent('')).toThrow()
    expect(() => loadContent('Test')).toThrow()
    expect(() => loadContent('prod')).toThrow()
  })
})

describe.each(CONTENT_SETS)('the %s set', (name) => {
  const content = loadContent(name)

  it(`has ${CONTENT_SIZE} challenges, each with a hint, and ${CONTENT_SIZE} decoys`, () => {
    expect(content.challenges).toHaveLength(CONTENT_SIZE)
    expect(content.decoys).toHaveLength(CONTENT_SIZE)
    for (const challenge of content.challenges) {
      expect(challenge.name.trim()).not.toBe('')
      expect(challenge.description.trim()).not.toBe('')
      expect(challenge.hint.trim()).not.toBe('')
    }
    for (const decoy of content.decoys) {
      expect(decoy.name.trim()).not.toBe('')
      expect(decoy.description.trim()).not.toBe('')
    }
  })

  it('has unique challenge and decoy names', () => {
    const challengeNames = content.challenges.map((c) => c.name.toLowerCase())
    const decoyNames = content.decoys.map((d) => d.name.toLowerCase())
    expect(new Set(challengeNames).size).toBe(CONTENT_SIZE)
    expect(new Set(decoyNames).size).toBe(CONTENT_SIZE)
  })
})

describe('the test set', () => {
  const content = loadContent('test')

  it('is the placeholders in docs/scope.md, numbered 1 to 20 in order', () => {
    content.challenges.forEach((challenge, i) => {
      expect(challenge.name).toBe(`Challenge ${i + 1}`)
      expect(challenge.hint).toBe(`Hint for Challenge ${i + 1}`)
      expect(challenge.description).toBe(`Description of Challenge ${i + 1}`)
    })
    content.decoys.forEach((decoy, i) => {
      expect(decoy.name).toBe(`Decoy ${i + 1}`)
      expect(decoy.description).toBe(`Description of Decoy ${i + 1}`)
    })
  })

  it('looks challenges and decoys up by number', () => {
    expect(getChallenge(content, 1).name).toBe('Challenge 1')
    expect(getChallenge(content, 20).name).toBe('Challenge 20')
    expect(getDecoy(content, 7).name).toBe('Decoy 7')
    for (const n of [0, 21, 1.5, -1, Number.NaN]) {
      expect(() => getChallenge(content, n)).toThrow(RangeError)
      expect(() => getDecoy(content, n)).toThrow(RangeError)
    }
  })
})

describe('the real set', () => {
  // Only the stray-asterisks fix is checked here, so no real text is quoted in
  // a test; the spelling fix was checked when the file was converted (see the log).
  it('has no stray asterisks', () => {
    for (const challenge of loadContent('real').challenges) {
      expect(challenge.hint).not.toContain('*')
    }
  })
})

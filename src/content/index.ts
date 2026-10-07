import { z } from 'zod'
import real from './real.json'
import test from './test.json'

// The game's content: challenges (each with its hint) and decoys. Two sets live
// in this folder, `test` (placeholders, for development, tests and the Thursday
// test run) and `real` (Danny's list). The Worker var CONTENT_SET picks one
// (CLAUDE.md rule 4). To change the content, edit the JSON and push to `main`.
//
// Challenges and decoys are identified by number, 1 to CONTENT_SIZE, in the
// order they appear in the file: challenge n is `challenges[n - 1]`.

export const CONTENT_SIZE = 20

export const CONTENT_SETS = ['test', 'real'] as const
export type ContentSetName = (typeof CONTENT_SETS)[number]

const text = z.string().trim().min(1)

const uniqueNames = (items: { name: string }[]) =>
  new Set(items.map((item) => item.name.toLowerCase())).size === items.length

const contentSchema = z.object({
  challenges: z
    .array(z.object({ name: text, description: text, hint: text }).strict())
    .length(CONTENT_SIZE)
    .refine(uniqueNames, 'Challenge names must be unique'),
  decoys: z
    .array(z.object({ name: text, description: text }).strict())
    .length(CONTENT_SIZE)
    .refine(uniqueNames, 'Decoy names must be unique'),
})

export type Content = z.infer<typeof contentSchema>
export type Challenge = Content['challenges'][number]
export type Decoy = Content['decoys'][number]

const files: Record<ContentSetName, unknown> = { test, real }
const parsed = new Map<ContentSetName, Content>()

// The content set the Worker is configured with: `loadContent(c.env.CONTENT_SET)`.
// Throws on an unknown set name or a malformed file, so a mistake fails loudly
// in tests and on the first request rather than showing a broken game.
export const loadContent = (contentSet: string): Content => {
  const name = z.enum(CONTENT_SETS).parse(contentSet)
  let content = parsed.get(name)
  if (!content) {
    content = contentSchema.parse(files[name])
    parsed.set(name, content)
  }
  return content
}

const byNumber = <T>(items: readonly T[], n: number, kind: string): T => {
  const item = Number.isInteger(n) ? items[n - 1] : undefined
  if (!item) throw new RangeError(`No ${kind} number ${n}`)
  return item
}

export const getChallenge = (content: Content, n: number): Challenge =>
  byNumber(content.challenges, n, 'challenge')

export const getDecoy = (content: Content, n: number): Decoy => byNumber(content.decoys, n, 'decoy')

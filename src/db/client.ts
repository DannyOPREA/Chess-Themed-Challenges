import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

// A Drizzle client over the Worker's D1 binding. Cheap to create, so make one
// per request: `const db = createDb(c.env.DB)`.
export const createDb = (d1: D1Database) => drizzle(d1, { schema })

export type Db = ReturnType<typeof createDb>

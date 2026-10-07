import { defineConfig } from 'drizzle-kit'

// Only used to generate migrations (`npm run db:generate`). Wrangler applies
// them: `npm run db:migrate:local` locally, and `npm run deploy` (the Workers
// Builds deploy command) in production before each deploy.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
})

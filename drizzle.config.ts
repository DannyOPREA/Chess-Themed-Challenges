import { defineConfig } from 'drizzle-kit'

// Only used to generate migrations (`npm run db:generate`). Wrangler applies
// them: `npm run db:migrate:local` locally. Applying them in production is set
// up by unit 1.03 (the default Workers Builds deploy command doesn't).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
})

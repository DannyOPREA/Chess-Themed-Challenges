// Copies the browser files of Pico CSS and htmx from node_modules into
// public/vendor/, where Workers static assets serves them. Wrangler runs this
// before `wrangler dev` and `wrangler deploy` (see "build" in wrangler.jsonc).
import { copyFileSync, mkdirSync } from 'node:fs'

const files = {
  'node_modules/@picocss/pico/css/pico.min.css': 'public/vendor/pico.min.css',
  'node_modules/htmx.org/dist/htmx.min.js': 'public/vendor/htmx.min.js',
}

mkdirSync('public/vendor', { recursive: true })
for (const [from, to] of Object.entries(files)) {
  copyFileSync(from, to)
}

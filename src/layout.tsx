import { jsxRenderer } from 'hono/jsx-renderer'

declare module 'hono' {
  interface ContextRenderer {
    (content: string | Promise<string>, props: { title: string }): Response
  }
}

// The page shell every screen shares: Pico CSS for styling and htmx for the
// polling and partial updates. Both are copied from node_modules into
// public/vendor/ at build time (scripts/copy-vendor.mjs).
export const layout = jsxRenderer(({ children, title }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="color-scheme" content="light dark" />
      <title>{title}</title>
      <link rel="stylesheet" href="/vendor/pico.min.css" />
      <script src="/vendor/htmx.min.js" defer></script>
    </head>
    <body>
      <main class="container">{children}</main>
    </body>
  </html>
))

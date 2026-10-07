import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../env'

// Shared pages for a bad or stale link and for unexpected errors, so a player
// always gets a way back to the start page instead of bare text.
const ErrorPage = ({ heading, text }: { heading: string; text: string }) => (
  <>
    <h1>{heading}</h1>
    <p>{text}</p>
    <p>
      <a href="/">Back to the start</a>
    </p>
  </>
)

export const notFound = (c: Context<AppEnv>) => {
  c.status(404)
  return c.render(<ErrorPage heading="Page not found" text="That link doesn't lead anywhere." />, {
    title: 'Page not found',
  })
}

export const onError = (err: Error, c: Context<AppEnv>) => {
  // Responses a middleware chose on purpose (such as the CSRF 403) pass through.
  if (err instanceof HTTPException) return err.getResponse()
  console.error(err)
  c.status(500)
  return c.render(<ErrorPage heading="Something went wrong" text="Please try again." />, {
    title: 'Something went wrong',
  })
}

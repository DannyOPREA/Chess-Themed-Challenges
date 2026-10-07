# Chess Themed Challenges

A mobile web app for a chess-themed pub crawl: each player gets a secret challenge and a decoy, accuses other players, and is scored at the reveal.

## Running it locally

```sh
npm ci
npm run db:migrate:local
npm run dev        # http://localhost:8787
npm test
npm run typecheck
```

The spec is [`docs/scope.md`](docs/scope.md) and the build plan is [`docs/phases.md`](docs/phases.md).

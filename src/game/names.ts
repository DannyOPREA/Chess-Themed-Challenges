// Player names are unique ignoring capitals (docs/scope.md, "Joining and
// rejoining"). The key is what the database's unique `players.name_key` column
// holds, and what a rejoin looks the player up by. Spaces at either end and
// repeated spaces are ignored too, so "Dan " and "dan" are the same player.
export const nameKey = (name: string): string =>
  name.trim().replace(/\s+/g, ' ').normalize('NFKC').toLowerCase()

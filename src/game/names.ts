// Player names are unique ignoring capitals (docs/scope.md, "Joining and
// rejoining"). The key is what the database's unique `players.name_key` column
// holds, and what a rejoin looks the player up by. Spaces at either end and
// repeated spaces are ignored too, so "Dan " and "dan" are the same player.
export const nameKey = (name: string): string =>
  name.trim().replace(/\s+/g, ' ').normalize('NFKC').toLowerCase()

// The name as shown on screens: as typed, but without the spaces `nameKey`
// ignores, so "  Dan  Smith " shows as "Dan Smith".
export const cleanName = (name: string): string => name.trim().replace(/\s+/g, ' ')

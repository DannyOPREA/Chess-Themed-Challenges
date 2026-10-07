// Player names are unique ignoring capitals (docs/scope.md, "Joining and
// rejoining"). The key is what the database's unique `players.name_key` column
// holds, and what a rejoin looks the player up by.
export const nameKey = (name: string): string => name.normalize('NFC').toLowerCase()

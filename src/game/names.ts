// Player names are unique ignoring capitals (docs/scope.md, "Joining and
// rejoining"). The key is what the database's unique `players.name_key` column
// holds, and what a rejoin looks the player up by. Spaces at either end and
// repeated spaces are ignored too, so "Dan " and "dan" are the same player.
export const nameKey = (name: string): string =>
  name.trim().replace(/\s+/g, ' ').normalize('NFKC').toLowerCase()

// The name as stored and shown on screens: as typed, but without the spaces
// `nameKey` ignores, so "  Dan  Smith " shows as "Dan Smith", and without
// invisible characters (control and format characters such as zero-width
// spaces), so a name can't look blank or look like someone else's.
export const cleanName = (name: string): string =>
  name
    .replace(/\s/g, ' ')
    .replace(/(?!\u200D)[\p{Cc}\p{Cf}]/gu, '')
    // The zero-width joiner stays only where it joins two emoji into one,
    // such as "👩‍💻".
    .replace(/(?<![\p{Extended_Pictographic}\p{Emoji_Modifier}]\uFE0F?)\u200D|\u200D(?!\p{Extended_Pictographic})/gu, '')
    .replace(/ +/g, ' ')
    .trim()

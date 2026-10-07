# Agreed scope: Chess pub crawl app

Agreed with Danny on 2026-10-07. This is the source of truth for game behaviour; change it only with Danny's OK. Event: **Saturday 2026-10-10**, one night only. About 20 players, all on their own phones with mobile data.

## What it is

This is a mobile web app. Each player is secretly given one chess-themed challenge to complete during the crawl without anyone noticing, plus an optional decoy behaviour to throw others off. Players try to work out each other's challenges and make accusations. At the end the app reveals everything and scores everyone.

## Content

- Danny's list of 20 challenges, 20 decoys and 20 hints is built into the app as it is (the original is `Challenges, Decoys and Hints.txt` in the project's shared files). To change it, edit the content in the repo and push to `main`. There is no editing screen.
- Fixes made on import: the stray "***" is removed from hint 10, and "awkardly" is corrected to "awkwardly" in hint 14.
- **Test content for the Thursday test run (Danny, 2026-10-07).** The test must not give anything away, so the app also has a placeholder set: "Challenge 1" to "Challenge 20", "Decoy 1" to "Decoy 20", and "Hint for Challenge 1" to "Hint for Challenge 20", with matching placeholder descriptions.
- A single setting in the Worker config, `CONTENT_SET`, picks `test` or `real`. It starts as `test`. After the Thursday test, one change (a PR Danny merges) switches it to `real`. The same change clears all game data (players, completions, accusations, phase back to Lobby), so Saturday starts from an empty lobby.
- Local development, automated tests, screenshots and PR descriptions use the test set. The repo stays public (Danny's choice, for branch protection); committing the real content file is fine.

## Game phases

The host moves the game from one phase to the next by hand. There are no timers.

1. **Lobby:** players join.
2. **Game on:** challenges are live. Players can mark their own challenge done and make or change accusations.
3. **Accusations closed:** everything is frozen. The host can still fix completions.
4. **Reveal:** final leaderboard and the full breakdown.

## Assignment

- Challenges and decoys are random, and each player's are different from everyone else's while there are 20 or fewer players. If there are more than 20, challenges and decoys get reused.
- Assignment happens when a player joins, or at the start of Game on for anyone already in the lobby. It never changes after that, including when someone rejoins.
- Late joiners are allowed during Game on and get an unused challenge.

## Player screen

- Shows their own challenge, decoy and completion status.
- An "I've done it" button that they can undo. This is the honour system, and the host can override it.
- The hint list: all 20 challenge names, each with its hint, visible from the start. Full challenge descriptions are only shown at the reveal.
- Accusations: pick another player, then pick a challenge name. Each player has one active guess per other player and can change or clear it until accusations close. Players can't accuse themselves.
- No feedback on accusations, and no one's completion status is visible, until the reveal.

## Detection and scoring

A player counts as **detected** if at least one other player's final guess about them is correct. It doesn't matter how many people got them.

| Outcome | Points |
|---|---|
| Completed, not detected | +5 |
| Completed but detected | +1 |
| Not completed | 0 |
| Each correct accusation | +2 |
| Each wrong accusation | −1 |

The decoy doesn't affect points. Tied players share a rank.

## Reveal

The reveal shows a final leaderboard. Each player gets a breakdown showing their challenge, decoy, whether they completed it, who detected them, and their own correct and wrong accusations. A big-screen one-by-one reveal is not in scope for Saturday.

## Joining and rejoining

- Players join from a QR code or link on their phone, with no app install and no accounts.
- They enter a name (which must be unique, ignoring capitals) and choose a 4-digit PIN.
- The phone remembers them. If they switch phones or clear the browser, the same name and PIN gets them back in with the same challenge, decoy, completion status and accusations.

## Host page

- A separate page protected by a password. Danny also plays as a normal player.
- What the host can do:
  - see who has joined
  - change the phase
  - mark or unmark a player's completion
  - remove a player
  - reset a player's PIN
  - show the join QR code
- It never shows anyone's challenge or decoy, so it can't spoil the game for Danny. The only exception is a clearly marked emergency "show all" button.

## Hosting and tech

- The app runs on Cloudflare's free plan: Cloudflare Workers runs the app and a D1 database stores the game. It's always on, keeps its data, and costs nothing.
- All game logic runs on the server, so a curious player can't read anyone else's challenge from the browser.
- Danny needs to create a free Cloudflare account. Deploying will be set up as a single step, with the details given at build time.
- The code lives in github.com/DannyOPREA/Chess-Themed-Challenges, which was empty at scoping time.

## Not in scope

- Editing challenges inside the app
- Hints that unlock gradually or on a timer
- Multiple games or events
- Accounts or email login
- Push notifications
- A big-screen reveal show

## Timeline

Build by Thursday 2026-10-08. Danny does a test run with a few phones on Thursday evening 2026-10-08, using the test content. After that the app is switched to the real content with a clean game. The crawl is on Saturday 2026-10-10.

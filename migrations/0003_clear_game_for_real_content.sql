-- Unit 4.01: clears the test game when the app switches to the real content
-- (docs/scope.md, "Content"), so Saturday starts from an empty Lobby. The same
-- three changes as the host page's reset (resetGame in src/db/host.ts). It runs
-- once, on the deploy that switches CONTENT_SET to "real", before the new
-- version goes live (scripts/deploy.sh applies migrations first). Player ids
-- keep counting up, so phones holding a test player's cookie are logged out.
DELETE FROM `accusations`;
DELETE FROM `players`;
UPDATE `game` SET `phase` = 'lobby' WHERE `id` = 1;

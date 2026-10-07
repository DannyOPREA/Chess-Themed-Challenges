-- A player's challenge and decoy never change once assigned (docs/scope.md,
-- "Assignment"). Assigning a player who has none yet is still allowed.
CREATE TRIGGER `players_assignment_final`
BEFORE UPDATE OF `challenge`, `decoy` ON `players`
WHEN OLD.`challenge` IS NOT NULL
  AND (NEW.`challenge` IS NOT OLD.`challenge` OR NEW.`decoy` IS NOT OLD.`decoy`)
BEGIN
  SELECT RAISE(ABORT, 'players_assignment_final');
END;

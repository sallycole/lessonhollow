-- Add is_guide_player flag to players table.
-- This explicitly marks the player record that corresponds to the guide
-- themselves (player 1, created during onboarding signup with the guide's
-- own name). The flag replaces the previous name-matching heuristic.
ALTER TABLE players
  ADD COLUMN is_guide_player BOOLEAN NOT NULL DEFAULT false;

-- Backfill: any existing player whose first/last name matches the guide's
-- auth metadata gets the flag. Accounts created via the new onboarding flow
-- after 2026-04-07 will already match. Older accounts without a self-player
-- (pre-onboarding-redesign) get nothing, which is correct.
UPDATE players p
SET is_guide_player = true
FROM auth.users u
WHERE p.guide_id = u.id
  AND lower(trim(p.first_name)) = lower(trim(u.raw_user_meta_data->>'first_name'))
  AND lower(trim(p.last_name)) = lower(trim(u.raw_user_meta_data->>'last_name'));

-- A guide should only ever have one self-player. Enforce uniqueness via a
-- partial unique index on (guide_id) where is_guide_player = true.
CREATE UNIQUE INDEX players_one_guide_player_per_guide
  ON players (guide_id)
  WHERE is_guide_player = true;

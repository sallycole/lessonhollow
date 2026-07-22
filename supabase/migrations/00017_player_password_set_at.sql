-- Track when a guide has explicitly set a password on their guide-as-player
-- account via the /players Edit dialog. The guide-player is created with the
-- guide's signup password automatically, but from the guide's perspective they
-- never chose a separate password for the Player view. This column lets the
-- UI distinguish "password auto-copied at signup" (null) from "password
-- explicitly chosen via Edit" (non-null), so the card copy can read either
-- "Use Edit to set your Player password" or "Use Edit to reset".
--
-- Applies to all players for consistency, not just guide-players, so the
-- signal is available if we ever want it elsewhere.
ALTER TABLE players
  ADD COLUMN player_password_set_at TIMESTAMPTZ;

-- Backfill: regular (non-guide) players had their password intentionally set
-- by the guide when the account was created. Mark those as set at their
-- creation time. Guide-players stay null because the password was auto-copied
-- from the guide's signup, not explicitly chosen for the Player view.
UPDATE players
SET player_password_set_at = created_at
WHERE is_guide_player = false;

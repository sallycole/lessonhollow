-- Add pause_log column to player_tasks for recording pause/unpause events
-- Used for duration calculation and automatic timeline placement
ALTER TABLE player_tasks ADD COLUMN pause_log jsonb DEFAULT '[]'::jsonb;

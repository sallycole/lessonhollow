-- Change default reward frequency from every 20 tasks to every 1 task
ALTER TABLE players ALTER COLUMN video_tasks_required SET DEFAULT 1;

-- Update all existing players that still have the old default
UPDATE players SET video_tasks_required = 1 WHERE video_tasks_required = 20;

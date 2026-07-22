-- Migration: Discovery schema additions (issue #184)
-- Adds published_at, renames fork_count → copy_count,
-- creates discovery feed index, and copy_count trigger.

-- 1. Add published_at column
ALTER TABLE curricula
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 2. Rename fork_count to copy_count (spec term)
ALTER TABLE curricula
  RENAME COLUMN fork_count TO copy_count;

-- 3. Partial index for efficient /discover feed queries
CREATE INDEX curricula_is_public_published_at_idx
  ON curricula(published_at DESC)
  WHERE is_public = true;

-- 4. Trigger: auto-increment copy_count when a curriculum is copied
CREATE OR REPLACE FUNCTION increment_copy_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.original_id IS NOT NULL THEN
    UPDATE curricula SET copy_count = copy_count + 1
    WHERE id = NEW.original_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_curriculum_copied
  AFTER INSERT ON curricula
  FOR EACH ROW
  WHEN (NEW.original_id IS NOT NULL)
  EXECUTE PROCEDURE increment_copy_count();

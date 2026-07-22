-- Migration: Fox songs storage bucket + title NOT NULL constraint
-- Related: REQ-082 (Archive fox songs)

-- Backfill any null titles before adding constraint
UPDATE speeches SET title = 'Untitled' WHERE title IS NULL;

-- Add NOT NULL constraint to match spec
ALTER TABLE speeches ALTER COLUMN title SET NOT NULL;

-- Create fox-songs storage bucket (private, 20 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fox-songs',
  'fox-songs',
  false,
  20971520,
  ARRAY['audio/mpeg', 'image/webp', 'image/jpeg', 'image/png']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies: guides can manage files for their players
CREATE POLICY "guides_manage_fox_songs" ON storage.objects
  FOR ALL USING (
    bucket_id = 'fox-songs'
    AND EXISTS (
      SELECT 1 FROM players
      WHERE players.id::text = (storage.foldername(name))[1]
      AND players.guide_id = auth.uid()
    )
  );

-- Players can read their own fox song files
CREATE POLICY "players_read_fox_songs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fox-songs'
    AND EXISTS (
      SELECT 1 FROM players
      WHERE players.id::text = (storage.foldername(name))[1]
      AND players.auth_user_id = auth.uid()
    )
  );

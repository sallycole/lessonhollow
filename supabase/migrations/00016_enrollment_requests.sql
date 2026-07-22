-- Enrollment requests: players request enrollment, guides approve or deny.

CREATE TABLE enrollment_requests (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id              UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  curriculum_id          UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  guide_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrollment_type        TEXT NOT NULL CHECK (enrollment_type IN ('core', 'elective', 'memorization')),
  study_days_per_week    NUMERIC(3,1) NOT NULL,
  tasks_per_study_day    INTEGER NOT NULL,
  target_completion_date DATE,
  target_loops           INTEGER,
  status                 TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  guide_response         TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one pending request per player+curriculum at a time
CREATE UNIQUE INDEX enrollment_requests_pending_unique
  ON enrollment_requests (player_id, curriculum_id)
  WHERE status = 'pending';

ALTER TABLE enrollment_requests ENABLE ROW LEVEL SECURITY;

-- Guides can manage requests for their players
CREATE POLICY "guides_manage_enrollment_requests" ON enrollment_requests
  FOR ALL USING (guide_id = auth.uid());

-- Players can read their own requests
CREATE POLICY "players_read_own_requests" ON enrollment_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = enrollment_requests.player_id
      AND players.auth_user_id = auth.uid()
    )
  );

-- Players can insert requests for themselves
CREATE POLICY "players_insert_own_requests" ON enrollment_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = enrollment_requests.player_id
      AND players.auth_user_id = auth.uid()
    )
  );

CREATE TRIGGER enrollment_requests_updated_at
  BEFORE UPDATE ON enrollment_requests
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

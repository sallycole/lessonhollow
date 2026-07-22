-- Curio — Full database schema
-- All tables use gen_random_uuid() for PKs, TIMESTAMPTZ for timestamps,
-- and a shared handle_updated_at() trigger. All tables have RLS enabled.

-- =============================================================================
-- Shared infrastructure
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- players — Player sub-accounts linked to guide accounts
-- =============================================================================

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  username TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  time_zone TEXT NOT NULL DEFAULT 'America/Chicago',
  encrypted_password TEXT,
  video_tasks_required INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Guides can CRUD their own players
CREATE POLICY "guides_crud_own_players" ON players
  FOR ALL USING (guide_id = auth.uid());

-- Players can read their own record via auth_user_id
CREATE POLICY "players_read_own_record" ON players
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE TRIGGER players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================================
-- curricula — Curriculum metadata owned by players
-- =============================================================================

CREATE TABLE curricula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  resource_url TEXT,
  publisher TEXT,
  grade_level TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  public_title TEXT,
  public_description TEXT,
  publisher_name TEXT,
  fork_count INTEGER NOT NULL DEFAULT 0,
  original_id UUID REFERENCES curricula(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE curricula ENABLE ROW LEVEL SECURITY;

-- Players CRUD their own curricula (guides access via masquerade)
CREATE POLICY "users_crud_own_curricula" ON curricula
  FOR ALL USING (user_id = auth.uid());

-- Public curricula are visible to all authenticated users
CREATE POLICY "public_curricula_visible" ON curricula
  FOR SELECT USING (is_public = true AND auth.uid() IS NOT NULL);

CREATE TRIGGER curricula_updated_at
  BEFORE UPDATE ON curricula
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Check public_description max length
ALTER TABLE curricula
  ADD CONSTRAINT curricula_public_description_length
  CHECK (char_length(public_description) <= 280);

-- =============================================================================
-- tasks — Individual tasks within a curriculum, ordered by position
-- =============================================================================

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  action_type TEXT NOT NULL CHECK (action_type IN ('Read', 'Watch', 'Listen', 'Do')),
  resource_url TEXT,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Tasks inherit access from parent curriculum's user_id
CREATE POLICY "tasks_via_curriculum_owner" ON tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM curricula
      WHERE curricula.id = tasks.curriculum_id
      AND curricula.user_id = auth.uid()
    )
  );

-- Tasks in public curricula are readable
CREATE POLICY "tasks_public_readable" ON tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM curricula
      WHERE curricula.id = tasks.curriculum_id
      AND curricula.is_public = true
      AND auth.uid() IS NOT NULL
    )
  );

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================================
-- enrollments — Links players to curricula with type-specific settings
-- =============================================================================

CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  curriculum_id UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  enrollment_type TEXT NOT NULL CHECK (enrollment_type IN ('core', 'elective', 'memorization')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'finished')),
  target_completion_date DATE,
  study_days_per_week NUMERIC(3,1),
  target_loops INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, curriculum_id)
);

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

-- Guides CRUD enrollments via player ownership
CREATE POLICY "guides_crud_enrollments" ON enrollments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = enrollments.player_id
      AND players.guide_id = auth.uid()
    )
  );

-- Players can read their own enrollments
CREATE POLICY "players_read_own_enrollments" ON enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = enrollments.player_id
      AND players.auth_user_id = auth.uid()
    )
  );

CREATE TRIGGER enrollments_updated_at
  BEFORE UPDATE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================================
-- player_tasks — Per-enrollment task status, timing, and progression
-- =============================================================================

CREATE TABLE player_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped', 'promoted')),
  time_spent_minutes INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  promoted_at TIMESTAMPTZ,
  display_order INTEGER,
  timer_started_at TIMESTAMPTZ,
  accumulated_seconds INTEGER NOT NULL DEFAULT 0,
  loop_number INTEGER NOT NULL DEFAULT 1,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (enrollment_id, task_id, loop_number)
);

ALTER TABLE player_tasks ENABLE ROW LEVEL SECURITY;

-- Guides CRUD player_tasks via enrollment→player chain
CREATE POLICY "guides_crud_player_tasks" ON player_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM enrollments
      JOIN players ON players.id = enrollments.player_id
      WHERE enrollments.id = player_tasks.enrollment_id
      AND players.guide_id = auth.uid()
    )
  );

-- Players can read their own player_tasks
CREATE POLICY "players_read_own_tasks" ON player_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM enrollments
      JOIN players ON players.id = enrollments.player_id
      WHERE enrollments.id = player_tasks.enrollment_id
      AND players.auth_user_id = auth.uid()
    )
  );

CREATE TRIGGER player_tasks_updated_at
  BEFORE UPDATE ON player_tasks
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================================
-- spontaneous_entries — Ad-hoc learning activities not tied to any curriculum
-- =============================================================================

CREATE TABLE spontaneous_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  action_type TEXT NOT NULL CHECK (action_type IN ('Read', 'Watch', 'Listen', 'Do')),
  resource_url TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  time_spent_minutes INTEGER,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE spontaneous_entries ENABLE ROW LEVEL SECURITY;

-- Guides CRUD via player ownership
CREATE POLICY "guides_crud_spontaneous" ON spontaneous_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = spontaneous_entries.player_id
      AND players.guide_id = auth.uid()
    )
  );

-- Players can read and insert their own entries
CREATE POLICY "players_read_own_spontaneous" ON spontaneous_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = spontaneous_entries.player_id
      AND players.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "players_insert_own_spontaneous" ON spontaneous_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = spontaneous_entries.player_id
      AND players.auth_user_id = auth.uid()
    )
  );

CREATE TRIGGER spontaneous_entries_updated_at
  BEFORE UPDATE ON spontaneous_entries
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =============================================================================
-- feedback — User feedback submissions
-- =============================================================================

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('Bug', 'Feature', 'Use Case', 'General')),
  title TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert and read their own feedback
CREATE POLICY "users_insert_own_feedback" ON feedback
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_read_own_feedback" ON feedback
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- speeches — Fox reward archive (AI-generated songs)
-- =============================================================================

CREATE TABLE speeches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  title TEXT,
  speech_text TEXT,
  audio_url TEXT,
  duration_seconds INTEGER,
  video_url TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('generating', 'completed', 'failed')),
  fal_request_id TEXT,
  video_prompt TEXT,
  mad_lib_data JSONB,
  generation_cost_cents INTEGER,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE speeches ENABLE ROW LEVEL SECURITY;

-- Guides CRUD speeches for their own players
CREATE POLICY "guides_crud_speeches" ON speeches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = speeches.player_id
      AND players.guide_id = auth.uid()
    )
  );

-- Players can read their own speeches
CREATE POLICY "players_read_own_speeches" ON speeches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = speeches.player_id
      AND players.auth_user_id = auth.uid()
    )
  );

-- =============================================================================
-- mcp_api_keys — Long-lived API keys for MCP access
-- =============================================================================

CREATE TABLE mcp_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('guide', 'player')),
  guide_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

ALTER TABLE mcp_api_keys ENABLE ROW LEVEL SECURITY;

-- Service role only — no user-level RLS policies (managed via admin client)

-- =============================================================================
-- user_api_keys — Encrypted third-party API keys (e.g., fal.ai)
-- =============================================================================

CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, service)
);

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- Users CRUD their own API keys
CREATE POLICY "users_crud_own_api_keys" ON user_api_keys
  FOR ALL USING (user_id = auth.uid());

CREATE TRIGGER user_api_keys_updated_at
  BEFORE UPDATE ON user_api_keys
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- MCP API keys for guide authentication to MCP server
-- Keys use gt3p_ prefix and SHA-256 hashed storage

CREATE TABLE mcp_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('guide', 'player')),
  guide_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- Fast lookup by hash for active keys (MCP auth)
CREATE INDEX idx_mcp_api_keys_hash_active ON mcp_api_keys(key_hash) WHERE revoked_at IS NULL;

-- List a guide's active keys
CREATE INDEX idx_mcp_api_keys_guide_active ON mcp_api_keys(guide_id) WHERE revoked_at IS NULL;

-- RLS enabled but only service role accesses this table
ALTER TABLE mcp_api_keys ENABLE ROW LEVEL SECURITY;

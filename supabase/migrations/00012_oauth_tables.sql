-- OAuth 2.1 tables for MCP ChatGPT integration
-- Follows the same RLS pattern as mcp_api_keys (service-role only)

-- Dynamic Client Registration (RFC 7591)
CREATE TABLE oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_secret_hash TEXT,
  client_id_issued_at BIGINT NOT NULL,
  client_secret_expires_at BIGINT,
  redirect_uris JSONB NOT NULL,
  client_name TEXT,
  client_uri TEXT,
  logo_uri TEXT,
  token_endpoint_auth_method TEXT DEFAULT 'none',
  grant_types JSONB,
  response_types JSONB,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE oauth_clients ENABLE ROW LEVEL SECURITY;

-- Authorization codes (short-lived, single-use)
CREATE TABLE oauth_authorization_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  scopes TEXT[],
  state TEXT,
  resource TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE oauth_authorization_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_oauth_codes_expires ON oauth_authorization_codes(expires_at);

-- Access and refresh tokens
CREATE TABLE oauth_tokens (
  token_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scopes TEXT[],
  token_type TEXT NOT NULL CHECK (token_type IN ('access', 'refresh')),
  expires_at TIMESTAMPTZ NOT NULL,
  resource TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_oauth_tokens_user ON oauth_tokens(user_id);
CREATE INDEX idx_oauth_tokens_expires ON oauth_tokens(expires_at);
CREATE INDEX idx_oauth_tokens_active ON oauth_tokens(token_hash) WHERE revoked_at IS NULL;

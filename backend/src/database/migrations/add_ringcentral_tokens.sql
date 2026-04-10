-- RingCentral OAuth Tokens (per-user)
CREATE TABLE IF NOT EXISTS ringcentral_tokens (
  id SERIAL PRIMARY KEY,
  org_id UUID NOT NULL,
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type VARCHAR(50) DEFAULT 'bearer',
  expires_at TIMESTAMPTZ,
  scope TEXT,
  owner_id VARCHAR(255),          -- RC account owner id
  endpoint_id VARCHAR(255),       -- RC endpoint id
  rc_extension_id VARCHAR(255),   -- RC extension ID (user's extension)
  rc_account_id VARCHAR(255),     -- RC account ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- Webhook subscription tracking
CREATE TABLE IF NOT EXISTS ringcentral_webhooks (
  id SERIAL PRIMARY KEY,
  org_id UUID NOT NULL,
  user_id UUID NOT NULL,
  subscription_id VARCHAR(255) NOT NULL,
  event_filters TEXT[],
  status VARCHAR(50) DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

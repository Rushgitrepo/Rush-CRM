-- Instantly.ai Integration Tables

-- Integration Settings
CREATE TABLE IF NOT EXISTS instantly_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  api_key_encrypted text,
  webhook_secret text,
  webhook_url text,
  is_enabled boolean DEFAULT false,
  status text DEFAULT 'disconnected', -- 'connected', 'disconnected', 'error'
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(org_id)
);

-- Unibox Events (incoming from webhooks)
CREATE TABLE IF NOT EXISTS instantly_unibox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- e.g., 'reply_received'
  payload jsonb NOT NULL,
  sender_email text,
  sender_name text,
  subject text,
  body_text text,
  phone text,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  processed boolean DEFAULT false,
  processed_at timestamp with time zone,
  error_message text,
  received_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Webhook Health Monitoring
CREATE TABLE IF NOT EXISTS instantly_webhook_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  webhook_url text NOT NULL,
  status text DEFAULT 'healthy',
  total_received integer DEFAULT 0,
  total_processed integer DEFAULT 0,
  total_failed integer DEFAULT 0,
  last_received_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(org_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_instantly_events_org ON instantly_unibox_events(org_id);
CREATE INDEX IF NOT EXISTS idx_instantly_events_processed ON instantly_unibox_events(processed);
CREATE INDEX IF NOT EXISTS idx_instantly_events_sender ON instantly_unibox_events(sender_email);

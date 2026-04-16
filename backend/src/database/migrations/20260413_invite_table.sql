
CREATE TABLE IF NOT EXISTS invites (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    role VARCHAR(50) NOT NULL,
    phone TEXT,
    position TEXT,
    department TEXT,
    module_permissions JSONB DEFAULT '{}'::jsonb,
    org_id UUID,
    invite_token TEXT UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- =====================================================
-- USERS TABLE MIGRATION
-- =====================================================

-- Add invite system columns
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP WITH TIME ZONE;

-- Add security + permissions columns
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS module_permissions JSONB DEFAULT '{}'::jsonb;

-- =====================================================
-- OPTIONAL: SAFE CHECK FOR FUTURE EXTENSIONS
-- =====================================================
DO $$
BEGIN
    -- (reserved for future user constraints if needed)
    NULL;
END $$;
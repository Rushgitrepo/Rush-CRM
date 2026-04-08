-- Migration to separate activities, comments, and documents for CRM entities

-- Create crm_comments table
CREATE TABLE IF NOT EXISTS public.crm_comments (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    user_id UUID,
    entity_type CHARACTER VARYING(50) NOT NULL,
    entity_id UUID NOT NULL,
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT crm_comments_pkey PRIMARY KEY (id)
);

-- Index for crm_comments
CREATE INDEX IF NOT EXISTS idx_crm_comments_entity ON public.crm_comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_comments_org ON public.crm_comments(org_id);

-- Create crm_documents table
CREATE TABLE IF NOT EXISTS public.crm_documents (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    user_id UUID,
    entity_type CHARACTER VARYING(50) NOT NULL,
    entity_id UUID NOT NULL,
    file_name CHARACTER VARYING(255) NOT NULL,
    file_path TEXT NOT NULL,
    mime_type CHARACTER VARYING(100),
    file_size BIGINT,
    provider CHARACTER VARYING(50) DEFAULT 'local',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT crm_documents_pkey PRIMARY KEY (id)
);

-- Index for crm_documents
CREATE INDEX IF NOT EXISTS idx_crm_documents_entity ON public.crm_documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_documents_org ON public.crm_documents(org_id);

-- Optional: Migrate existing comments from crm_activities to crm_comments
-- This part is commented out to prevent accidental data loss and should be run manually if needed
-- INSERT INTO public.crm_comments (id, org_id, user_id, entity_type, entity_id, content, created_at, updated_at)
-- SELECT id, org_id, user_id, entity_type, entity_id, description, created_at, updated_at
-- FROM public.crm_activities
-- WHERE activity_type = 'comment';

-- DELETE FROM public.crm_activities WHERE activity_type = 'comment';

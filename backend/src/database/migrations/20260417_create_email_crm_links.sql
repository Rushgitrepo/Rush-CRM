-- Create email_crm_links table to track connections between emails and CRM entities
CREATE TABLE IF NOT EXISTS public.email_crm_links (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
    email_id uuid REFERENCES emails(id) ON DELETE CASCADE,
    entity_type character varying(50) NOT NULL, -- 'contact', 'lead', 'deal', 'company'
    entity_id uuid NOT NULL,
    link_type character varying(50) DEFAULT 'converted', -- 'converted', 'manually_linked'
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(email_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_email_crm_links_email_id ON email_crm_links(email_id);
CREATE INDEX IF NOT EXISTS idx_email_crm_links_entity ON email_crm_links(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS project_templates (
    id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_milestones JSONB DEFAULT '[]',
    default_tasks JSONB DEFAULT '[]',
    settings JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_templates_org_id ON project_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_project_templates_organization_id ON project_templates(organization_id);

-- Optional: Add trigger for updated_at if function exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_project_templates_updated_at') THEN
            CREATE TRIGGER update_project_templates_updated_at
                BEFORE UPDATE ON project_templates
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        END IF;
    END IF;
END $$;

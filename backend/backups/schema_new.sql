-- ============================================================================
-- Rush CRM â€” Extensions & Reusable Functions
-- File: 00_extensions_and_functions.sql
-- Description: PostgreSQL extensions and shared trigger/utility functions.
--              Must be executed FIRST before any table definitions.
-- ============================================================================

-- Required Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- FUNCTION: update_updated_at_column()
-- Automatically sets updated_at = CURRENT_TIMESTAMP on row update.
-- Used by most tables via BEFORE UPDATE triggers.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: add_creator_as_owner()
-- When a workgroup is created, auto-inserts the creator as an 'owner' member.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.add_creator_as_owner()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO workgroup_members (workgroup_id, user_id, role, joined_at)
    VALUES (NEW.id, NEW.created_by, 'owner', CURRENT_TIMESTAMP);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: create_default_channel()
-- When a workgroup is created, auto-creates a 'General' channel.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_default_channel()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO workgroup_channels (workgroup_id, name, description, type, is_general, created_by)
    VALUES (NEW.id, 'General', 'General discussion for the team', 'standard', true, NEW.created_by);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: log_stock_movement()
-- Logs a stock_movements record whenever stock.quantity changes.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.quantity != NEW.quantity THEN
        INSERT INTO stock_movements (
            org_id, product_id, warehouse_id, movement_type, quantity, reason, created_by
        ) VALUES (
            NEW.org_id,
            NEW.product_id,
            NEW.warehouse_id,
            CASE WHEN NEW.quantity > OLD.quantity THEN 'stock_in' ELSE 'stock_out' END,
            ABS(NEW.quantity - OLD.quantity),
            'Stock updated',
            (SELECT id FROM users LIMIT 1)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: update_leave_remaining_days()
-- Recalculates remaining_days on leave_balances insert/update.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_leave_remaining_days()
RETURNS TRIGGER AS $$
BEGIN
    NEW.remaining_days = NEW.total_days - NEW.used_days;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: update_stock_available_quantity()
-- Recalculates available_quantity on stock insert/update.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_stock_available_quantity()
RETURNS TRIGGER AS $$
BEGIN
    NEW.available_quantity = NEW.quantity - NEW.reserved_quantity;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: update_workgroup_member_count()
-- Increments/decrements workgroups.member_count on member insert/delete.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_workgroup_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE workgroups
        SET member_count = member_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.workgroup_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE workgroups
        SET member_count = member_count - 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.workgroup_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: update_workgroup_message_count()
-- Increments/decrements workgroups.message_count on post insert/delete.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_workgroup_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE workgroups
        SET message_count = message_count + 1,
            last_activity_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.workgroup_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE workgroups
        SET message_count = message_count - 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.workgroup_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: update_car_updated_at()
-- Dedicated updated_at trigger for car inventory module tables.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_car_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- ============================================================================
-- Rush CRM â€” Core Tables (Organizations, Users, Roles, Profiles)
-- File: 01_core_tables.sql
-- Description: Foundational identity & authorization tables.
--              Every other module references these.
-- ============================================================================

-- ===================== ORGANIZATIONS =====================
COMMENT ON TABLE organizations IS 'Top-level tenant. All data is scoped to an organization.';

CREATE TABLE IF NOT EXISTS organizations (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(255) NOT NULL,
    slug          VARCHAR(255) UNIQUE,
    industry      VARCHAR(100),
    website       VARCHAR(255),
    phone         VARCHAR(50),
    email         VARCHAR(255),
    address       TEXT,
    city          VARCHAR(100),
    state         VARCHAR(100),
    country       VARCHAR(100),
    postal_code   VARCHAR(20),
    logo_url      VARCHAR(500),
    settings      JSONB DEFAULT '{}',
    subscription_plan VARCHAR(50) DEFAULT 'free',
    subscription_status VARCHAR(50) DEFAULT 'active',
    max_users     INTEGER DEFAULT 10,
    timezone      VARCHAR(100) DEFAULT 'UTC',
    currency      VARCHAR(10) DEFAULT 'USD',
    fiscal_year_start INTEGER DEFAULT 1,  -- month number (1 = January)
    created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== USERS =====================
COMMENT ON TABLE users IS 'Application users. Each user belongs to one organization.';

CREATE TABLE IF NOT EXISTS users (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id  UUID,           -- legacy column kept for compatibility
    org_id           UUID,           -- preferred org reference
    name             VARCHAR(255) NOT NULL,
    email            VARCHAR(255) NOT NULL UNIQUE,
    password         VARCHAR(255),
    avatar           VARCHAR(500),
    phone            VARCHAR(50),
    role             VARCHAR(50) DEFAULT 'user',
    status           VARCHAR(50) DEFAULT 'active',
    last_login       TIMESTAMP WITHOUT TIME ZONE,
    email_verified   BOOLEAN DEFAULT false,
    settings         JSONB DEFAULT '{}',
    created_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT users_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_email        ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_organization ON users (organization_id);

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== ROLES =====================
COMMENT ON TABLE roles IS 'Custom roles defined per organization for RBAC.';

CREATE TABLE IF NOT EXISTS roles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    permissions     JSONB DEFAULT '{}',
    is_system       BOOLEAN DEFAULT false,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT roles_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== USER_ROLES (junction) =====================
COMMENT ON TABLE user_roles IS 'Many-to-many link between users and roles.';

CREATE TABLE IF NOT EXISTS user_roles (
    user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id  UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);


-- ===================== PROFILES =====================
COMMENT ON TABLE profiles IS 'Extended user profile information.';

CREATE TABLE IF NOT EXISTS profiles (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name  VARCHAR(100),
    phone      VARCHAR(50),
    avatar_url VARCHAR(500),
    bio        TEXT,
    department VARCHAR(100),
    job_title  VARCHAR(100),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== NOTIFICATIONS =====================
COMMENT ON TABLE notifications IS 'System notifications delivered to individual users.';

CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    message         TEXT,
    type            VARCHAR(50) DEFAULT 'info',
    is_read         BOOLEAN DEFAULT false,
    data            JSONB DEFAULT '{}',
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at         TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT notifications_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);


-- ===================== NOTIFICATION_TEMPLATES =====================
COMMENT ON TABLE notification_templates IS 'Reusable notification templates per org.';

CREATE TABLE IF NOT EXISTS notification_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(50),
    subject         VARCHAR(255),
    body            TEXT,
    variables       JSONB DEFAULT '[]',
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT notification_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT notification_templates_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TRIGGER update_notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ============================================================================
-- Rush CRM â€” CRM Tables (Leads, Deals, Contacts, Companies, Customers, etc.)
-- File: 02_crm_tables.sql
-- Description: Sales pipeline, contact management, and customer lifecycle.
-- ============================================================================

-- ===================== COMPANIES =====================
COMMENT ON TABLE companies IS 'B2B company accounts linked to contacts and deals.';

CREATE TABLE IF NOT EXISTS companies (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    industry        VARCHAR(100),
    website         VARCHAR(255),
    phone           VARCHAR(50),
    email           VARCHAR(255),
    address         TEXT,
    city            VARCHAR(100),
    state           VARCHAR(100),
    country         VARCHAR(100),
    postal_code     VARCHAR(20),
    logo_url        VARCHAR(500),
    description     TEXT,
    annual_revenue  NUMERIC(15,2),
    employee_count  INTEGER,
    owner_id        UUID,
    created_by      UUID,
    tags            VARCHAR[] DEFAULT '{}',
    custom_fields   JSONB DEFAULT '{}',
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT companies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT companies_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT companies_owner_id_fkey        FOREIGN KEY (owner_id)        REFERENCES users(id),
    CONSTRAINT companies_created_by_fkey      FOREIGN KEY (created_by)      REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_companies_organization ON companies (organization_id);

CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== CONTACTS =====================
COMMENT ON TABLE contacts IS 'Individual people â€” may be linked to a company, lead, or deal.';

CREATE TABLE IF NOT EXISTS contacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    email           VARCHAR(255),
    phone           VARCHAR(50),
    mobile          VARCHAR(50),
    job_title       VARCHAR(100),
    department      VARCHAR(100),
    company_id      UUID,
    company_name    VARCHAR(255),
    address         TEXT,
    city            VARCHAR(100),
    state           VARCHAR(100),
    country         VARCHAR(100),
    postal_code     VARCHAR(20),
    source          VARCHAR(100),
    status          VARCHAR(50) DEFAULT 'active',
    lifecycle_stage VARCHAR(50),
    lead_score      INTEGER DEFAULT 0,
    owner_id        UUID,
    responsible_id  UUID,
    created_by      UUID,
    last_contacted  TIMESTAMP WITHOUT TIME ZONE,
    tags            VARCHAR[] DEFAULT '{}',
    custom_fields   JSONB DEFAULT '{}',
    social_profiles JSONB DEFAULT '{}',
    notes           TEXT,
    avatar          VARCHAR(500),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT contacts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT contacts_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id),
    CONSTRAINT contacts_company_id_fkey      FOREIGN KEY (company_id)      REFERENCES companies(id),
    CONSTRAINT contacts_owner_id_fkey        FOREIGN KEY (owner_id)        REFERENCES users(id),
    CONSTRAINT contacts_responsible_id_fkey  FOREIGN KEY (responsible_id)  REFERENCES users(id),
    CONSTRAINT contacts_created_by_fkey      FOREIGN KEY (created_by)      REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_contacts_email        ON contacts (email);
CREATE INDEX IF NOT EXISTS idx_contacts_organization ON contacts (organization_id);

CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== LEAD_EXTERNAL_SOURCES =====================
COMMENT ON TABLE lead_external_sources IS 'External lead capture sources (forms, APIs, webhooks).';

CREATE TABLE IF NOT EXISTS lead_external_sources (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(50),
    api_key         VARCHAR(255),
    webhook_url     VARCHAR(500),
    is_active       BOOLEAN DEFAULT true,
    config          JSONB DEFAULT '{}',
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT lead_external_sources_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT lead_external_sources_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);


-- ===================== PIPELINE_STAGES =====================
COMMENT ON TABLE pipeline_stages IS 'Configurable deal pipeline stages per org.';

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    "order"    INTEGER DEFAULT 0,
    color      VARCHAR(50),
    is_active  BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_org ON pipeline_stages (org_id);


-- ===================== LEAD_WORKSPACES =====================
COMMENT ON TABLE lead_workspaces IS 'Workspaces/boards used to organize leads into groups.';

CREATE TABLE IF NOT EXISTS lead_workspaces (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    type            VARCHAR(50) DEFAULT 'board',
    is_default      BOOLEAN DEFAULT false,
    settings        JSONB DEFAULT '{}',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT lead_workspaces_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT lead_workspaces_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);


-- ===================== LEADS =====================
COMMENT ON TABLE leads IS 'Sales leads â€” the entry point of the CRM pipeline.';

CREATE TABLE IF NOT EXISTS leads (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id      UUID,
    org_id               UUID,
    workspace_id         UUID,
    first_name           VARCHAR(100),
    last_name            VARCHAR(100),
    email                VARCHAR(255),
    phone                VARCHAR(50),
    company              VARCHAR(255),
    job_title            VARCHAR(100),
    source               VARCHAR(100),
    status               VARCHAR(50) DEFAULT 'new',
    priority             VARCHAR(50) DEFAULT 'medium',
    score                INTEGER DEFAULT 0,
    assigned_to          UUID,
    owner_id             UUID,
    contact_id           UUID,
    description          TEXT,
    address              TEXT,
    city                 VARCHAR(100),
    state                VARCHAR(100),
    country              VARCHAR(100),
    postal_code          VARCHAR(20),
    website              VARCHAR(255),
    industry             VARCHAR(100),
    annual_revenue       NUMERIC(15,2),
    employee_count       INTEGER,
    tags                 VARCHAR[] DEFAULT '{}',
    custom_fields        JSONB DEFAULT '{}',
    last_contacted       TIMESTAMP WITHOUT TIME ZONE,
    next_follow_up       TIMESTAMP WITHOUT TIME ZONE,
    converted_at         TIMESTAMP WITHOUT TIME ZONE,
    converted_to_deal_id UUID,
    lost_reason          VARCHAR(255),
    lost_at              TIMESTAMP WITHOUT TIME ZONE,
    import_id            UUID,
    external_source_id   UUID,
    created_by           UUID,
    created_at           TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT leads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT leads_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id),
    CONSTRAINT leads_assigned_to_fkey     FOREIGN KEY (assigned_to)     REFERENCES users(id),
    CONSTRAINT leads_owner_id_fkey        FOREIGN KEY (owner_id)        REFERENCES users(id),
    CONSTRAINT leads_contact_id_fkey      FOREIGN KEY (contact_id)      REFERENCES contacts(id),
    CONSTRAINT leads_created_by_fkey      FOREIGN KEY (created_by)      REFERENCES users(id)
);

-- converted_to_deal_id FK is added later after deals table exists

CREATE INDEX IF NOT EXISTS idx_leads_organization ON leads (organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_workspace_id ON leads (workspace_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to  ON leads (assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_by   ON leads (created_by);
CREATE INDEX IF NOT EXISTS idx_leads_import_id    ON leads (import_id);
CREATE INDEX IF NOT EXISTS idx_leads_converted_to_deal_id ON leads (converted_to_deal_id);

CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== LEAD_WORKSPACE_ACCESS =====================
COMMENT ON TABLE lead_workspace_access IS 'Controls user access to specific lead workspaces.';

CREATE TABLE IF NOT EXISTS lead_workspace_access (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workgroups(id) ON DELETE CASCADE,
    granted_by   UUID REFERENCES users(id),
    access_level VARCHAR(50) DEFAULT 'read',
    created_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== LEAD_IMPORTS =====================
COMMENT ON TABLE lead_imports IS 'Tracks bulk lead import jobs (CSV, API, etc.).';

CREATE TABLE IF NOT EXISTS lead_imports (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workspace_id      UUID,
    file_name         VARCHAR(255),
    file_url          VARCHAR(500),
    status            VARCHAR(50) DEFAULT 'pending',
    total_rows        INTEGER DEFAULT 0,
    imported_rows     INTEGER DEFAULT 0,
    failed_rows       INTEGER DEFAULT 0,
    duplicate_rows    INTEGER DEFAULT 0,
    error_log         JSONB DEFAULT '[]',
    field_mapping     JSONB DEFAULT '{}',
    imported_by       UUID REFERENCES users(id),
    started_at        TIMESTAMP WITHOUT TIME ZONE,
    completed_at      TIMESTAMP WITHOUT TIME ZONE,
    created_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_imports_org_id       ON lead_imports (org_id);
CREATE INDEX IF NOT EXISTS idx_lead_imports_workspace_id ON lead_imports (workspace_id);
CREATE INDEX IF NOT EXISTS idx_lead_imports_imported_by  ON lead_imports (imported_by);
CREATE INDEX IF NOT EXISTS idx_lead_imports_status       ON lead_imports (status);


-- ===================== CUSTOMERS =====================
COMMENT ON TABLE customers IS 'Converted customers from won deals or direct creation.';

CREATE TABLE IF NOT EXISTS customers (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id       UUID,
    org_id                UUID,
    name                  VARCHAR(255) NOT NULL,
    email                 VARCHAR(255),
    phone                 VARCHAR(50),
    company               VARCHAR(255),
    company_id            UUID,
    contact_id            UUID,
    status                VARCHAR(50) DEFAULT 'active',
    type                  VARCHAR(50) DEFAULT 'individual',
    address               TEXT,
    city                  VARCHAR(100),
    state                 VARCHAR(100),
    country               VARCHAR(100),
    postal_code           VARCHAR(20),
    website               VARCHAR(255),
    industry              VARCHAR(100),
    annual_revenue        NUMERIC(15,2),
    notes                 TEXT,
    tags                  VARCHAR[] DEFAULT '{}',
    custom_fields         JSONB DEFAULT '{}',
    converted_from_lead_id UUID,
    converted_from_deal_id UUID,
    owner_id              UUID,
    created_by            UUID,
    created_at            TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT customers_organization_id_fkey       FOREIGN KEY (organization_id)       REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT customers_org_id_fkey                FOREIGN KEY (org_id)                REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT customers_company_id_fkey            FOREIGN KEY (company_id)            REFERENCES companies(id),
    CONSTRAINT customers_contact_id_fkey            FOREIGN KEY (contact_id)            REFERENCES contacts(id),
    CONSTRAINT customers_converted_from_lead_id_fkey FOREIGN KEY (converted_from_lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

-- converted_from_deal_id FK added after deals table exists

CREATE INDEX IF NOT EXISTS idx_customers_converted_lead ON customers (converted_from_lead_id);
CREATE INDEX IF NOT EXISTS idx_customers_converted_deal ON customers (converted_from_deal_id);

CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== DEALS =====================
COMMENT ON TABLE deals IS 'Sales deals â€” opportunities being actively worked.';

CREATE TABLE IF NOT EXISTS deals (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id         UUID,
    org_id                  UUID,
    workspace_id            UUID,
    title                   VARCHAR(255) NOT NULL,
    value                   NUMERIC(15,2),
    currency                VARCHAR(10) DEFAULT 'USD',
    stage                   VARCHAR(100),
    stage_id                UUID,
    status                  VARCHAR(50) DEFAULT 'open',
    priority                VARCHAR(50) DEFAULT 'medium',
    probability             INTEGER DEFAULT 0,
    expected_close_date     DATE,
    actual_close_date       DATE,
    contact_id              UUID,
    contact_name            VARCHAR(255),
    company_id              UUID,
    company_name            VARCHAR(255),
    email                   VARCHAR(255),
    phone                   VARCHAR(50),
    source                  VARCHAR(100),
    assigned_to             UUID,
    owner_id                UUID,
    description             TEXT,
    notes                   TEXT,
    tags                    VARCHAR[] DEFAULT '{}',
    custom_fields           JSONB DEFAULT '{}',
    lost_reason             VARCHAR(255),
    won_reason              VARCHAR(255),
    converted_from_lead_id  UUID,
    converted_to_customer_id UUID,
    external_source_id      UUID,
    agent_name              VARCHAR(255),
    service_interested      VARCHAR(255),
    next_follow_up          TIMESTAMP WITHOUT TIME ZONE,
    created_by              UUID,
    created_at              TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT deals_organization_id_fkey        FOREIGN KEY (organization_id)        REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT deals_org_id_fkey                 FOREIGN KEY (org_id)                 REFERENCES organizations(id),
    CONSTRAINT deals_contact_id_fkey             FOREIGN KEY (contact_id)             REFERENCES contacts(id),
    CONSTRAINT deals_company_id_fkey             FOREIGN KEY (company_id)             REFERENCES companies(id),
    CONSTRAINT deals_assigned_to_fkey            FOREIGN KEY (assigned_to)            REFERENCES users(id),
    CONSTRAINT deals_owner_id_fkey               FOREIGN KEY (owner_id)               REFERENCES users(id),
    CONSTRAINT deals_converted_from_lead_id_fkey FOREIGN KEY (converted_from_lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    CONSTRAINT deals_converted_to_customer_id_fkey FOREIGN KEY (converted_to_customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_deals_organization    ON deals (organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_workspace_id    ON deals (workspace_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact         ON deals (contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_email           ON deals (email);
CREATE INDEX IF NOT EXISTS idx_deals_source          ON deals (source);
CREATE INDEX IF NOT EXISTS idx_deals_priority        ON deals (priority);
CREATE INDEX IF NOT EXISTS idx_deals_agent_name      ON deals (agent_name);
CREATE INDEX IF NOT EXISTS idx_deals_company_name    ON deals (company_name);
CREATE INDEX IF NOT EXISTS idx_deals_contact_name    ON deals (contact_name);
CREATE INDEX IF NOT EXISTS idx_deals_service_interested ON deals (service_interested);
CREATE INDEX IF NOT EXISTS idx_deals_external_source ON deals (external_source_id);
CREATE INDEX IF NOT EXISTS idx_deals_converted_lead  ON deals (converted_from_lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_converted_customer ON deals (converted_to_customer_id);

CREATE TRIGGER update_deals_updated_at
    BEFORE UPDATE ON deals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Now add deferred FK for leads â†’ deals
ALTER TABLE leads
    ADD CONSTRAINT leads_converted_to_deal_id_fkey
    FOREIGN KEY (converted_to_deal_id) REFERENCES deals(id);

-- Now add deferred FK for customers â†’ deals
ALTER TABLE customers
    ADD CONSTRAINT customers_converted_from_deal_id_fkey
    FOREIGN KEY (converted_from_deal_id) REFERENCES deals(id) ON DELETE SET NULL;

-- deals â†’ workgroups FK (workgroups table created later, so we defer)
-- ALTER TABLE deals ADD CONSTRAINT deals_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workgroups(id) ON DELETE SET NULL;


-- ===================== DEAL_CONTACTS =====================
COMMENT ON TABLE deal_contacts IS 'Many-to-many link between deals and contacts.';

CREATE TABLE IF NOT EXISTS deal_contacts (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id    UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role       VARCHAR(100),
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (deal_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_contacts_deal    ON deal_contacts (deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_contacts_contact ON deal_contacts (contact_id);
CREATE INDEX IF NOT EXISTS idx_deal_contacts_org     ON deal_contacts (org_id);


-- ===================== SIGNING_PARTIES =====================
COMMENT ON TABLE signing_parties IS 'Parties involved in signing contracts/documents.';

CREATE TABLE IF NOT EXISTS signing_parties (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255),
    phone           VARCHAR(50),
    role            VARCHAR(100),
    status          VARCHAR(50) DEFAULT 'pending',
    signed_at       TIMESTAMP WITHOUT TIME ZONE,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT signing_parties_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT signing_parties_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);


-- ===================== DEAL_SIGNING_PARTIES =====================
COMMENT ON TABLE deal_signing_parties IS 'Signing parties associated with specific deals.';

CREATE TABLE IF NOT EXISTS deal_signing_parties (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id    UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name       VARCHAR(255),
    email      VARCHAR(255),
    role       VARCHAR(100),
    status     VARCHAR(50) DEFAULT 'pending',
    signed_at  TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deal_signing_parties_deal    ON deal_signing_parties (deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_signing_parties_contact ON deal_signing_parties (contact_id);
CREATE INDEX IF NOT EXISTS idx_deal_signing_parties_org     ON deal_signing_parties (org_id);


-- ===================== ACTIVITIES =====================
COMMENT ON TABLE activities IS 'CRM activities (calls, meetings, emails, tasks) linked to leads/deals/contacts.';

CREATE TABLE IF NOT EXISTS activities (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    type            VARCHAR(50) NOT NULL,   -- call, meeting, email, task, note
    subject         VARCHAR(255),
    description     TEXT,
    contact_id      UUID,
    deal_id         UUID,
    company_id      UUID,
    lead_id         UUID,
    assigned_to     UUID,
    owner_id        UUID,
    due_date        TIMESTAMP WITHOUT TIME ZONE,
    completed       BOOLEAN DEFAULT false,
    completed_at    TIMESTAMP WITHOUT TIME ZONE,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT activities_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT activities_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT activities_contact_id_fkey      FOREIGN KEY (contact_id)      REFERENCES contacts(id),
    CONSTRAINT activities_deal_id_fkey         FOREIGN KEY (deal_id)         REFERENCES deals(id),
    CONSTRAINT activities_company_id_fkey      FOREIGN KEY (company_id)      REFERENCES companies(id),
    CONSTRAINT activities_lead_id_fkey         FOREIGN KEY (lead_id)         REFERENCES leads(id),
    CONSTRAINT activities_assigned_to_fkey     FOREIGN KEY (assigned_to)     REFERENCES users(id),
    CONSTRAINT activities_owner_id_fkey        FOREIGN KEY (owner_id)        REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_activities_contact      ON activities (contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_organization ON activities (organization_id);

CREATE TRIGGER update_activities_updated_at
    BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== CRM_COMMENTS =====================
COMMENT ON TABLE crm_comments IS 'User comments on any CRM entity (polymorphic via entity_type/entity_id).';

CREATE TABLE IF NOT EXISTS crm_comments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,   -- lead, deal, contact, customer
    entity_id   UUID NOT NULL,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crm_comments_entity ON crm_comments (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_comments_org    ON crm_comments (org_id);


-- ===================== CRM_DOCUMENTS =====================
COMMENT ON TABLE crm_documents IS 'File attachments linked to any CRM entity.';

CREATE TABLE IF NOT EXISTS crm_documents (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id   UUID NOT NULL,
    file_name   VARCHAR(255) NOT NULL,
    file_url    VARCHAR(500) NOT NULL,
    file_size   INTEGER,
    mime_type   VARCHAR(100),
    uploaded_by UUID REFERENCES users(id),
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_crm_documents_entity ON crm_documents (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_documents_org    ON crm_documents (org_id);


-- ===================== CALL_LOGS =====================
COMMENT ON TABLE call_logs IS 'Phone call records linked to CRM contacts.';

CREATE TABLE IF NOT EXISTS call_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    user_id         UUID REFERENCES users(id),
    contact_id      UUID REFERENCES contacts(id),
    direction       VARCHAR(20),     -- inbound, outbound
    status          VARCHAR(50),
    duration        INTEGER,         -- seconds
    recording_url   VARCHAR(500),
    notes           TEXT,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT call_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT call_logs_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);


-- ===================== EMAILS (CRM-linked) =====================
COMMENT ON TABLE emails IS 'Email records linked to CRM entities for tracking.';

CREATE TABLE IF NOT EXISTS emails (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    subject         VARCHAR(500),
    body            TEXT,
    from_email      VARCHAR(255),
    to_emails       VARCHAR[] DEFAULT '{}',
    cc_emails       VARCHAR[] DEFAULT '{}',
    bcc_emails      VARCHAR[] DEFAULT '{}',
    direction       VARCHAR(20),
    status          VARCHAR(50) DEFAULT 'draft',
    sent_at         TIMESTAMP WITHOUT TIME ZONE,
    received_at     TIMESTAMP WITHOUT TIME ZONE,
    thread_id       VARCHAR(255),
    message_id      VARCHAR(255),
    in_reply_to     VARCHAR(255),
    attachments     JSONB DEFAULT '[]',
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT emails_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT emails_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);


-- ===================== UNIBOX_EMAILS =====================
COMMENT ON TABLE unibox_emails IS 'Unified inbox â€” aggregated email view across all connected mailboxes.';

CREATE TABLE IF NOT EXISTS unibox_emails (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    mailbox_id       UUID,
    message_id       VARCHAR(255),
    thread_id        VARCHAR(255),
    subject          VARCHAR(500),
    body_text        TEXT,
    body_html        TEXT,
    sender_email     VARCHAR(255),
    sender_name      VARCHAR(255),
    recipients       JSONB DEFAULT '[]',
    cc               JSONB DEFAULT '[]',
    bcc              JSONB DEFAULT '[]',
    direction        VARCHAR(20),
    status           VARCHAR(50) DEFAULT 'unread',
    is_starred       BOOLEAN DEFAULT false,
    is_archived      BOOLEAN DEFAULT false,
    labels           VARCHAR[] DEFAULT '{}',
    attachments      JSONB DEFAULT '[]',
    contact_id       UUID,
    deal_id          UUID,
    lead_id          UUID,
    received_at      TIMESTAMP WITHOUT TIME ZONE,
    sent_at          TIMESTAMP WITHOUT TIME ZONE,
    created_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_unibox_emails_org    ON unibox_emails (org_id);
CREATE INDEX IF NOT EXISTS idx_unibox_emails_sender ON unibox_emails (sender_email);
CREATE INDEX IF NOT EXISTS idx_unibox_emails_status ON unibox_emails (status);


-- ===================== CONNECTED_MAILBOXES =====================
COMMENT ON TABLE connected_mailboxes IS 'OAuth-connected email accounts for the unified inbox.';

CREATE TABLE IF NOT EXISTS connected_mailboxes (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_address VARCHAR(255) NOT NULL,
    provider      VARCHAR(50),    -- google, microsoft, custom
    access_token  TEXT,
    refresh_token TEXT,
    token_expiry  TIMESTAMP WITHOUT TIME ZONE,
    is_active     BOOLEAN DEFAULT true,
    sync_status   VARCHAR(50) DEFAULT 'idle',
    last_synced   TIMESTAMP WITHOUT TIME ZONE,
    settings      JSONB DEFAULT '{}',
    created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== CALENDAR_EVENTS =====================
COMMENT ON TABLE calendar_events IS 'Calendar events linked to CRM users and organizations.';

CREATE TABLE IF NOT EXISTS calendar_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    start_time      TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    end_time        TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    all_day         BOOLEAN DEFAULT false,
    location        VARCHAR(255),
    color           VARCHAR(50),
    type            VARCHAR(50),
    status          VARCHAR(50) DEFAULT 'scheduled',
    recurrence      JSONB,
    reminders       JSONB DEFAULT '[]',
    attendees       JSONB DEFAULT '[]',
    created_by      UUID REFERENCES users(id),
    entity_type     VARCHAR(50),
    entity_id       UUID,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT calendar_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT calendar_events_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TRIGGER update_calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== CALENDAR_EVENT_ATTENDEES =====================
CREATE TABLE IF NOT EXISTS calendar_event_attendees (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id   UUID REFERENCES calendar_events(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    status     VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- ============================================================================
-- Rush CRM â€” HRMS Tables (Employees, Attendance, Payroll, Leave)
-- File: 03_hrms_tables.sql
-- ============================================================================

-- ===================== EMPLOYEES =====================
COMMENT ON TABLE employees IS 'Employee records â€” the core entity of the HRMS module.';

CREATE TABLE IF NOT EXISTS employees (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id      UUID,
    org_id               UUID,
    user_id              UUID,
    employee_id_number   VARCHAR(50),
    first_name           VARCHAR(100) NOT NULL,
    last_name            VARCHAR(100),
    email                VARCHAR(255),
    phone                VARCHAR(50),
    mobile               VARCHAR(50),
    date_of_birth        DATE,
    gender               VARCHAR(20),
    marital_status       VARCHAR(30),
    blood_group          VARCHAR(10),
    nationality          VARCHAR(100),
    emergency_contact    JSONB DEFAULT '{}',
    -- Employment info
    department           VARCHAR(100),
    designation          VARCHAR(100),
    job_title            VARCHAR(100),
    employment_type      VARCHAR(50) DEFAULT 'full_time',
    employment_status    VARCHAR(50) DEFAULT 'active',
    joining_date         DATE,
    confirmation_date    DATE,
    probation_end_date   DATE,
    notice_period_days   INTEGER DEFAULT 30,
    resignation_date     DATE,
    relieving_date       DATE,
    exit_date            DATE,
    -- Reporting
    manager_id           UUID,
    reporting_manager_id UUID,
    -- Compensation
    ctc                  NUMERIC(15,2),
    basic_salary         NUMERIC(15,2),
    salary               NUMERIC(15,2),
    bank_name            VARCHAR(255),
    bank_account_number  VARCHAR(100),
    ifsc_code            VARCHAR(20),
    pan_number           VARCHAR(20),
    pf_number            VARCHAR(50),
    uan_number           VARCHAR(50),
    esi_number           VARCHAR(50),
    -- Address
    current_address      TEXT,
    permanent_address    TEXT,
    city                 VARCHAR(100),
    state                VARCHAR(100),
    country              VARCHAR(100),
    postal_code          VARCHAR(20),
    -- Work
    work_location        VARCHAR(255),
    shift                VARCHAR(100),
    weekly_off           VARCHAR(50),
    -- Profile
    avatar               VARCHAR(500),
    bio                  TEXT,
    skills               VARCHAR[] DEFAULT '{}',
    qualifications       JSONB DEFAULT '[]',
    certifications       JSONB DEFAULT '[]',
    -- Metadata
    custom_fields        JSONB DEFAULT '{}',
    notes                TEXT,
    tags                 VARCHAR[] DEFAULT '{}',
    created_by           UUID,
    created_at           TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT employees_organization_id_fkey      FOREIGN KEY (organization_id)      REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT employees_org_id_fkey               FOREIGN KEY (org_id)               REFERENCES organizations(id),
    CONSTRAINT employees_user_id_fkey              FOREIGN KEY (user_id)              REFERENCES users(id),
    CONSTRAINT employees_manager_id_fkey           FOREIGN KEY (manager_id)           REFERENCES employees(id),
    CONSTRAINT employees_reporting_manager_id_fkey FOREIGN KEY (reporting_manager_id) REFERENCES employees(id),
    CONSTRAINT employees_created_by_fkey           FOREIGN KEY (created_by)           REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_employees_organization ON employees (organization_id);

CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== EMPLOYEE_SALARIES =====================
COMMENT ON TABLE employee_salaries IS 'Salary history and structure per employee.';

CREATE TABLE IF NOT EXISTS employee_salaries (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
    basic_salary      NUMERIC(15,2),
    gross_salary      NUMERIC(15,2),
    net_salary        NUMERIC(15,2),
    effective_from    DATE,
    effective_to      DATE,
    is_current        BOOLEAN DEFAULT true,
    components        JSONB DEFAULT '[]',
    created_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_salaries_employee ON employee_salaries (employee_id);


-- ===================== EMPLOYEE_DOCUMENTS =====================
COMMENT ON TABLE employee_documents IS 'Personal and employment documents uploaded for employees.';

CREATE TABLE IF NOT EXISTS employee_documents (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    file_url      VARCHAR(500) NOT NULL,
    file_size     INTEGER,
    mime_type     VARCHAR(100),
    expiry_date   DATE,
    notes         TEXT,
    verified      BOOLEAN DEFAULT false,
    verified_by   UUID,
    uploaded_by   UUID REFERENCES users(id),
    created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents (employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_org      ON employee_documents (org_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_type     ON employee_documents (document_type);


-- ===================== EMPLOYEE_PRODUCT_ASSIGNMENTS =====================
COMMENT ON TABLE employee_product_assignments IS 'Tracks which products/assets are assigned to employees.';

CREATE TABLE IF NOT EXISTS employee_product_assignments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    product_id  UUID,
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status      VARCHAR(50) DEFAULT 'assigned',
    assigned_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    returned_at TIMESTAMP WITHOUT TIME ZONE,
    notes       TEXT,
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_epa_employee_id ON employee_product_assignments (employee_id);
CREATE INDEX IF NOT EXISTS idx_epa_product_id  ON employee_product_assignments (product_id);
CREATE INDEX IF NOT EXISTS idx_epa_org_id      ON employee_product_assignments (org_id);
CREATE INDEX IF NOT EXISTS idx_epa_status      ON employee_product_assignments (status);


-- ===================== ATTENDANCE =====================
COMMENT ON TABLE attendance IS 'Daily attendance records per employee (clock in/out, breaks).';

CREATE TABLE IF NOT EXISTS attendance (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
    user_id         UUID,
    date            DATE NOT NULL,
    check_in        TIMESTAMP WITHOUT TIME ZONE,
    check_out       TIMESTAMP WITHOUT TIME ZONE,
    clock_in        TIMESTAMP WITHOUT TIME ZONE,
    clock_out       TIMESTAMP WITHOUT TIME ZONE,
    status          VARCHAR(50) DEFAULT 'present',
    hours_worked    NUMERIC(5,2),
    total_hours     NUMERIC(5,2),
    late_minutes    INTEGER DEFAULT 0,
    overtime_hours  NUMERIC(5,2) DEFAULT 0,
    break_duration  INTEGER DEFAULT 0,
    break_start     TIMESTAMP WITHOUT TIME ZONE,
    break_end       TIMESTAMP WITHOUT TIME ZONE,
    location        VARCHAR(255),
    location_lat    NUMERIC,
    location_lng    NUMERIC,
    ip_address      VARCHAR(50),
    device_info     TEXT,
    notes           TEXT,
    created_by      UUID,
    updated_by      UUID,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT attendance_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT attendance_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance (employee_id);

CREATE TRIGGER update_attendance_updated_at
    BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== LEAVE_TYPES =====================
COMMENT ON TABLE leave_types IS 'Configurable leave categories (Annual, Sick, etc.) per org.';

CREATE TABLE IF NOT EXISTS leave_types (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(100) NOT NULL,
    code            VARCHAR(20),
    description     TEXT,
    default_days    NUMERIC(5,1) DEFAULT 0,
    is_paid         BOOLEAN DEFAULT true,
    is_active       BOOLEAN DEFAULT true,
    carry_forward   BOOLEAN DEFAULT false,
    max_carry_forward NUMERIC(5,1) DEFAULT 0,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT leave_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT leave_types_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);


-- ===================== LEAVE_BALANCES (legacy) =====================
CREATE TABLE IF NOT EXISTS leave_balances (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type     VARCHAR(100),
    total_days     NUMERIC(5,1) DEFAULT 0,
    used_days      NUMERIC(5,1) DEFAULT 0,
    remaining_days NUMERIC(5,1) DEFAULT 0,
    year           INTEGER,
    created_at     TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER trigger_update_leave_balance
    BEFORE INSERT OR UPDATE ON leave_balances
    FOR EACH ROW EXECUTE FUNCTION update_leave_remaining_days();


-- ===================== EMPLOYEE_LEAVE_BALANCES =====================
COMMENT ON TABLE employee_leave_balances IS 'Per-employee leave balance per type per year.';

CREATE TABLE IF NOT EXISTS employee_leave_balances (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID REFERENCES leave_types(id) ON DELETE CASCADE,
    org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
    year          INTEGER NOT NULL,
    total_days    NUMERIC(5,1) DEFAULT 0,
    used_days     NUMERIC(5,1) DEFAULT 0,
    pending_days  NUMERIC(5,1) DEFAULT 0,
    remaining_days NUMERIC(5,1) DEFAULT 0,
    created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (employee_id, leave_type_id, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_employee ON employee_leave_balances (employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_org      ON employee_leave_balances (org_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_year     ON employee_leave_balances (year);


-- ===================== LEAVE_REQUESTS =====================
COMMENT ON TABLE leave_requests IS 'Employee leave applications with approval workflow.';

CREATE TABLE IF NOT EXISTS leave_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id   UUID REFERENCES leave_types(id),
    leave_type      VARCHAR(100),
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    duration        NUMERIC(5,1),
    day_type        VARCHAR(20) DEFAULT 'full_day',
    reason          TEXT,
    status          VARCHAR(50) DEFAULT 'pending'
        CHECK (status IN ('pending','approved','rejected','cancelled','withdrawn')),
    approved_by     UUID REFERENCES users(id),
    approver_id     UUID REFERENCES users(id),
    approved_at     TIMESTAMP WITHOUT TIME ZONE,
    rejection_reason TEXT,
    notes           TEXT,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT leave_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT leave_requests_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT chk_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_org      ON leave_requests (org_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates    ON leave_requests (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status   ON leave_requests (status);


-- ===================== LEAVE_REQUEST_COMMENTS =====================
CREATE TABLE IF NOT EXISTS leave_request_comments (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    leave_request_id UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    user_id          UUID REFERENCES users(id),
    comment          TEXT NOT NULL,
    created_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leave_comments_request ON leave_request_comments (leave_request_id);


-- ===================== PUBLIC_HOLIDAYS =====================
COMMENT ON TABLE public_holidays IS 'Organization-specific public holidays calendar.';

CREATE TABLE IF NOT EXISTS public_holidays (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    date       DATE NOT NULL,
    type       VARCHAR(50) DEFAULT 'public',
    is_optional BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (org_id, date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_org_date ON public_holidays (org_id, date);


-- ===================== PAYROLL =====================
COMMENT ON TABLE payroll IS 'Monthly payroll processing records.';

CREATE TABLE IF NOT EXISTS payroll (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    month           INTEGER NOT NULL,
    year            INTEGER NOT NULL,
    basic_salary    NUMERIC(15,2),
    gross_salary    NUMERIC(15,2),
    total_deductions NUMERIC(15,2) DEFAULT 0,
    net_salary      NUMERIC(15,2),
    earnings        JSONB DEFAULT '[]',
    deductions      JSONB DEFAULT '[]',
    status          VARCHAR(50) DEFAULT 'draft',
    paid_on         DATE,
    payment_method  VARCHAR(50),
    transaction_id  VARCHAR(255),
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT payroll_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT payroll_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE,
    UNIQUE (org_id, employee_id, month, year)
);

CREATE TRIGGER update_payroll_updated_at
    BEFORE UPDATE ON payroll
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== SALARY_COMPONENTS =====================
COMMENT ON TABLE salary_components IS 'Reusable salary structure components (HRA, DA, Tax, etc.).';

CREATE TABLE IF NOT EXISTS salary_components (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(50) NOT NULL,   -- earning, deduction
    calculation_type VARCHAR(50) DEFAULT 'fixed',
    percentage_of   VARCHAR(100),
    default_amount  NUMERIC(15,2) DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    is_taxable      BOOLEAN DEFAULT true,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_salary_components_org ON salary_components (org_id);


-- ===================== SALARY_SLIPS =====================
COMMENT ON TABLE salary_slips IS 'Generated monthly salary slips per employee.';

CREATE TABLE IF NOT EXISTS salary_slips (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    month           INTEGER NOT NULL,
    year            INTEGER NOT NULL,
    gross_pay       NUMERIC(15,2),
    total_deductions NUMERIC(15,2) DEFAULT 0,
    net_pay         NUMERIC(15,2),
    status          VARCHAR(50) DEFAULT 'draft',
    generated_at    TIMESTAMP WITHOUT TIME ZONE,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (org_id, employee_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_salary_slips_employee   ON salary_slips (employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_slips_month_year ON salary_slips (month, year);


-- ===================== SALARY_SLIP_ITEMS =====================
CREATE TABLE IF NOT EXISTS salary_slip_items (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    salary_slip_id UUID NOT NULL REFERENCES salary_slips(id) ON DELETE CASCADE,
    component_id   UUID REFERENCES salary_components(id),
    name           VARCHAR(255),
    type           VARCHAR(50),
    amount         NUMERIC(15,2) DEFAULT 0,
    created_at     TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== HRMS_NOTIFICATIONS =====================
COMMENT ON TABLE hrms_notifications IS 'HRMS-specific notifications (leave approvals, payroll, etc.).';

CREATE TABLE IF NOT EXISTS hrms_notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    employee_id     UUID REFERENCES employees(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    message         TEXT,
    type            VARCHAR(50) DEFAULT 'info',
    is_read         BOOLEAN DEFAULT false,
    data            JSONB DEFAULT '{}',
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at         TIMESTAMP WITHOUT TIME ZONE,

    CONSTRAINT hrms_notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT hrms_notifications_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);
-- ============================================================================
-- Rush CRM â€” Project Management Tables
-- File: 04_project_tables.sql
-- ============================================================================

-- ===================== PROJECTS =====================
COMMENT ON TABLE projects IS 'Projects linked to an organization, optionally to a customer.';

CREATE TABLE IF NOT EXISTS projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(50) DEFAULT 'planning',
    priority        VARCHAR(50) DEFAULT 'medium',
    start_date      DATE,
    end_date        DATE,
    actual_start    DATE,
    actual_end      DATE,
    budget          NUMERIC(15,2),
    spent           NUMERIC(15,2) DEFAULT 0,
    progress        INTEGER DEFAULT 0,
    client_id       UUID,
    manager_id      UUID REFERENCES users(id),
    owner_id        UUID REFERENCES users(id),
    category        VARCHAR(100),
    tags            VARCHAR[] DEFAULT '{}',
    settings        JSONB DEFAULT '{}',
    custom_fields   JSONB DEFAULT '{}',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT projects_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT projects_client_id_fkey       FOREIGN KEY (client_id)       REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_projects_organization ON projects (organization_id);

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== PROJECT_MEMBERS =====================
CREATE TABLE IF NOT EXISTS project_members (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members (project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user    ON project_members (user_id);


-- ===================== PROJECT_MILESTONES =====================
COMMENT ON TABLE project_milestones IS 'Key milestones within a project timeline.';

CREATE TABLE IF NOT EXISTS project_milestones (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    due_date    DATE,
    status      VARCHAR(50) DEFAULT 'pending',
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== PROJECT_TASKS =====================
COMMENT ON TABLE project_tasks IS 'Tasks within a project, supports subtasks via parent_task_id.';

CREATE TABLE IF NOT EXISTS project_tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_task_id  UUID REFERENCES project_tasks(id),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(50) DEFAULT 'todo',
    priority        VARCHAR(50) DEFAULT 'medium',
    assigned_to     UUID REFERENCES users(id),
    milestone_id    UUID,
    start_date      DATE,
    due_date        DATE,
    completed_at    TIMESTAMP WITHOUT TIME ZONE,
    estimated_hours NUMERIC(8,2),
    actual_hours    NUMERIC(8,2),
    progress        INTEGER DEFAULT 0,
    tags            VARCHAR[] DEFAULT '{}',
    attachments     JSONB DEFAULT '[]',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT project_tasks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT project_tasks_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_parent ON project_tasks (parent_task_id);

CREATE TRIGGER update_project_tasks_updated_at
    BEFORE UPDATE ON project_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== TASKS (standalone) =====================
COMMENT ON TABLE tasks IS 'Standalone tasks not tied to a specific project.';

CREATE TABLE IF NOT EXISTS tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(50) DEFAULT 'todo',
    priority        VARCHAR(50) DEFAULT 'medium',
    assigned_to     UUID,
    milestone_id    UUID,
    parent_task_id  UUID REFERENCES tasks(id),
    start_date      DATE,
    due_date        DATE,
    completed_at    TIMESTAMP WITHOUT TIME ZONE,
    estimated_hours NUMERIC(8,2),
    actual_hours    NUMERIC(8,2),
    created_by      UUID,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks (milestone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent    ON tasks (parent_task_id);


-- ===================== PROJECT_TIME_ENTRIES =====================
COMMENT ON TABLE project_time_entries IS 'Time tracked by users against project tasks.';

CREATE TABLE IF NOT EXISTS project_time_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id         UUID REFERENCES project_tasks(id),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description     TEXT,
    hours           NUMERIC(8,2) NOT NULL,
    date            DATE NOT NULL,
    is_billable     BOOLEAN DEFAULT true,
    rate            NUMERIC(10,2),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT project_time_entries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT project_time_entries_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);


-- ===================== PROJECT_RISKS =====================
COMMENT ON TABLE project_risks IS 'Risk register for managing project-level risks.';

CREATE TABLE IF NOT EXISTS project_risks (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    category     VARCHAR(100),
    probability  VARCHAR(50),
    impact       VARCHAR(50),
    status       VARCHAR(50) DEFAULT 'open',
    mitigation   TEXT,
    owner_id     UUID REFERENCES users(id),
    identified_date DATE,
    due_date     DATE,
    created_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_project_risks_updated_at
    BEFORE UPDATE ON project_risks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== PROJECT_COMMENTS =====================
CREATE TABLE IF NOT EXISTS project_comments (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    task_id    UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_comments_project ON project_comments (project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_task    ON project_comments (task_id);


-- ===================== PROJECT_ATTACHMENTS =====================
CREATE TABLE IF NOT EXISTS project_attachments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id     UUID,
    file_name   VARCHAR(255) NOT NULL,
    file_url    VARCHAR(500) NOT NULL,
    file_size   INTEGER,
    mime_type   VARCHAR(100),
    uploaded_by UUID REFERENCES users(id),
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_attachments_project ON project_attachments (project_id);


-- ===================== PROJECT_ACTIVITY_LOGS =====================
CREATE TABLE IF NOT EXISTS project_activity_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id   UUID,
    details     JSONB DEFAULT '{}',
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_activity_logs_project ON project_activity_logs (project_id);


-- ===================== PROJECT_DOCUMENTS =====================
CREATE TABLE IF NOT EXISTS project_documents (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        VARCHAR(255),
    file_url    VARCHAR(500),
    file_size   INTEGER,
    mime_type   VARCHAR(100),
    uploaded_by UUID REFERENCES users(id),
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== PROJECT_TEMPLATES =====================
COMMENT ON TABLE project_templates IS 'Reusable project templates with default milestones and tasks.';

CREATE TABLE IF NOT EXISTS project_templates (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id    UUID REFERENCES organizations(id) ON DELETE CASCADE,
    org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name               VARCHAR(255) NOT NULL,
    description        TEXT,
    default_milestones JSONB DEFAULT '[]',
    default_tasks      JSONB DEFAULT '[]',
    settings           JSONB DEFAULT '{}',
    created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at         TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_templates_org_id ON project_templates (org_id);

CREATE TRIGGER update_project_templates_updated_at
    BEFORE UPDATE ON project_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== PROJECT_INVOICES =====================
COMMENT ON TABLE project_invoices IS 'Invoices issued for project work.';

CREATE TABLE IF NOT EXISTS project_invoices (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id         UUID NOT NULL REFERENCES organizations(id),
    project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    invoice_number VARCHAR(255) NOT NULL,
    amount         NUMERIC(15,2) NOT NULL,
    currency       VARCHAR(10) DEFAULT 'USD',
    status         VARCHAR(50) DEFAULT 'draft'
        CHECK (status IN ('draft','sent','paid','void','overdue','cancelled')),
    issue_date     DATE NOT NULL,
    due_date       DATE,
    paid_date      DATE,
    description    TEXT,
    created_by     UUID REFERENCES users(id),
    created_at     TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_invoices_project_id ON project_invoices (project_id);
CREATE INDEX IF NOT EXISTS idx_project_invoices_org_id     ON project_invoices (org_id);

CREATE TRIGGER update_project_invoices_updated_at
    BEFORE UPDATE ON project_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== PROJECT_NOTIFICATIONS =====================
CREATE TABLE IF NOT EXISTS project_notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id     UUID NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(255) NOT NULL,
    message    TEXT,
    type       VARCHAR(50) DEFAULT 'info'
        CHECK (type IN ('info','warning','success','error')),
    is_read    BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at    TIMESTAMP WITHOUT TIME ZONE,
    data       JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_project_notifications_user_project ON project_notifications (user_id, project_id);
-- ============================================================================
-- Rush CRM â€” Marketing Tables
-- File: 05_marketing_tables.sql
-- ============================================================================

-- ===================== MARKETING_CAMPAIGNS =====================
COMMENT ON TABLE marketing_campaigns IS 'Email and multi-channel marketing campaigns.';

CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    type            VARCHAR(50),              -- email, sms, social, multi
    status          VARCHAR(50) DEFAULT 'draft',
    subject         VARCHAR(500),
    content         TEXT,
    html_content    TEXT,
    from_name       VARCHAR(255),
    from_email      VARCHAR(255),
    reply_to        VARCHAR(255),
    list_id         UUID,
    segment_id      UUID,
    scheduled_at    TIMESTAMP WITHOUT TIME ZONE,
    sent_at         TIMESTAMP WITHOUT TIME ZONE,
    completed_at    TIMESTAMP WITHOUT TIME ZONE,
    -- Stats
    total_recipients INTEGER DEFAULT 0,
    sent_count       INTEGER DEFAULT 0,
    delivered_count  INTEGER DEFAULT 0,
    open_count       INTEGER DEFAULT 0,
    click_count      INTEGER DEFAULT 0,
    bounce_count     INTEGER DEFAULT 0,
    unsubscribe_count INTEGER DEFAULT 0,
    complaint_count  INTEGER DEFAULT 0,
    -- Meta
    settings        JSONB DEFAULT '{}',
    tags            VARCHAR[] DEFAULT '{}',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT marketing_campaigns_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT marketing_campaigns_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_org ON marketing_campaigns (organization_id);

CREATE TRIGGER update_marketing_campaigns_updated_at
    BEFORE UPDATE ON marketing_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== MARKETING_CAMPAIGN_EVENTS =====================
CREATE TABLE IF NOT EXISTS marketing_campaign_events (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    contact_id  UUID REFERENCES contacts(id) ON DELETE CASCADE,
    event_type  VARCHAR(50) NOT NULL,         -- sent, delivered, opened, clicked, bounced
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_marketing_events_campaign ON marketing_campaign_events (campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_events_contact  ON marketing_campaign_events (contact_id);


-- ===================== MARKETING_LISTS =====================
COMMENT ON TABLE marketing_lists IS 'Contact lists used for campaign targeting.';

CREATE TABLE IF NOT EXISTS marketing_lists (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    type            VARCHAR(50) DEFAULT 'static',
    member_count    INTEGER DEFAULT 0,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT marketing_lists_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT marketing_lists_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_marketing_lists_org ON marketing_lists (organization_id);

CREATE TRIGGER update_marketing_lists_updated_at
    BEFORE UPDATE ON marketing_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== MARKETING_LIST_MEMBERS =====================
CREATE TABLE IF NOT EXISTS marketing_list_members (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_id     UUID NOT NULL REFERENCES marketing_lists(id) ON DELETE CASCADE,
    contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    org_id      UUID REFERENCES organizations(id),
    status      VARCHAR(50) DEFAULT 'active',
    subscribed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (list_id, contact_id)
);


-- ===================== MARKETING_FORMS =====================
COMMENT ON TABLE marketing_forms IS 'Web forms for lead capture and list subscription.';

CREATE TABLE IF NOT EXISTS marketing_forms (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    fields          JSONB DEFAULT '[]',
    settings        JSONB DEFAULT '{}',
    list_id         UUID REFERENCES marketing_lists(id),
    status          VARCHAR(50) DEFAULT 'active',
    submission_count INTEGER DEFAULT 0,
    embed_code      TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT marketing_forms_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT marketing_forms_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TRIGGER update_marketing_forms_updated_at
    BEFORE UPDATE ON marketing_forms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== MARKETING_FORM_SUBMISSIONS =====================
CREATE TABLE IF NOT EXISTS marketing_form_submissions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id     UUID NOT NULL REFERENCES marketing_forms(id) ON DELETE CASCADE,
    contact_id  UUID REFERENCES contacts(id),
    data        JSONB DEFAULT '{}',
    source_url  VARCHAR(500),
    ip_address  VARCHAR(50),
    user_agent  TEXT,
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== MARKETING_SEGMENTS =====================
COMMENT ON TABLE marketing_segments IS 'Dynamic contact segments based on filter rules.';

CREATE TABLE IF NOT EXISTS marketing_segments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    rules           JSONB DEFAULT '[]',
    member_count    INTEGER DEFAULT 0,
    is_dynamic      BOOLEAN DEFAULT true,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT marketing_segments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT marketing_segments_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TRIGGER update_marketing_segments_updated_at
    BEFORE UPDATE ON marketing_segments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== MARKETING_TEMPLATES =====================
COMMENT ON TABLE marketing_templates IS 'Reusable email/content templates for campaigns.';

CREATE TABLE IF NOT EXISTS marketing_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    type            VARCHAR(50) DEFAULT 'email',
    subject         VARCHAR(500),
    content         TEXT,
    html_content    TEXT,
    thumbnail_url   VARCHAR(500),
    is_active       BOOLEAN DEFAULT true,
    category        VARCHAR(100),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT marketing_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT marketing_templates_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TRIGGER update_marketing_templates_updated_at
    BEFORE UPDATE ON marketing_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== MARKETING_SEQUENCES =====================
COMMENT ON TABLE marketing_sequences IS 'Automated email sequences with timed steps.';

CREATE TABLE IF NOT EXISTS marketing_sequences (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    status          VARCHAR(50) DEFAULT 'draft',
    trigger_type    VARCHAR(50),
    settings        JSONB DEFAULT '{}',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT marketing_sequences_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT marketing_sequences_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TRIGGER update_marketing_sequences_updated_at
    BEFORE UPDATE ON marketing_sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== MARKETING_SEQUENCE_STEPS =====================
CREATE TABLE IF NOT EXISTS marketing_sequence_steps (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id UUID NOT NULL REFERENCES marketing_sequences(id) ON DELETE CASCADE,
    step_order  INTEGER NOT NULL,
    type        VARCHAR(50),
    delay_days  INTEGER DEFAULT 0,
    subject     VARCHAR(500),
    content     TEXT,
    template_id UUID,
    settings    JSONB DEFAULT '{}',
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== MARKETING_SEQUENCE_ENROLLMENTS =====================
CREATE TABLE IF NOT EXISTS marketing_sequence_enrollments (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id  UUID NOT NULL REFERENCES marketing_sequences(id) ON DELETE CASCADE,
    contact_id   UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    current_step INTEGER DEFAULT 0,
    status       VARCHAR(50) DEFAULT 'active',
    enrolled_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITHOUT TIME ZONE,
    created_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== MARKETING_AB_TESTS =====================
COMMENT ON TABLE marketing_ab_tests IS 'A/B testing configuration for marketing campaigns.';

CREATE TABLE IF NOT EXISTS marketing_ab_tests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    campaign_id     UUID,
    status          VARCHAR(50) DEFAULT 'draft',
    test_type       VARCHAR(50),              -- subject, content, send_time
    winning_criteria VARCHAR(50),
    auto_select_winner BOOLEAN DEFAULT false,
    winner_variant_id UUID,
    created_by      UUID REFERENCES users(id),
    started_at      TIMESTAMP WITHOUT TIME ZONE,
    ended_at        TIMESTAMP WITHOUT TIME ZONE,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT marketing_ab_tests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT marketing_ab_tests_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);


-- ===================== MARKETING_AB_TEST_VARIANTS =====================
CREATE TABLE IF NOT EXISTS marketing_ab_test_variants (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id    UUID NOT NULL REFERENCES marketing_ab_tests(id) ON DELETE CASCADE,
    name       VARCHAR(100),
    subject    VARCHAR(500),
    content    TEXT,
    weight     INTEGER DEFAULT 50,
    sent_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== MARKETING_AB_TEST_RESULTS =====================
CREATE TABLE IF NOT EXISTS marketing_ab_test_results (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id    UUID NOT NULL REFERENCES marketing_ab_tests(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES marketing_ab_test_variants(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    event_type VARCHAR(50),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== MARKETING_SCORING_RULES =====================
COMMENT ON TABLE marketing_scoring_rules IS 'Lead scoring rules for automated contact scoring.';

CREATE TABLE IF NOT EXISTS marketing_scoring_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    condition_type  VARCHAR(50),
    condition_value JSONB DEFAULT '{}',
    score_change    INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT marketing_scoring_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT marketing_scoring_rules_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);


-- ===================== MARKETING_SCORING_HISTORY =====================
CREATE TABLE IF NOT EXISTS marketing_scoring_history (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    rule_id     UUID REFERENCES marketing_scoring_rules(id),
    score_change INTEGER,
    reason      TEXT,
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== MARKETING_WEBHOOKS =====================
COMMENT ON TABLE marketing_webhooks IS 'Outgoing webhook integrations for marketing events.';

CREATE TABLE IF NOT EXISTS marketing_webhooks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    url             VARCHAR(500) NOT NULL,
    events          VARCHAR[] DEFAULT '{}',
    secret          VARCHAR(255),
    is_active       BOOLEAN DEFAULT true,
    headers         JSONB DEFAULT '{}',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT marketing_webhooks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT marketing_webhooks_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);


-- ===================== MARKETING_WEBHOOK_LOGS =====================
CREATE TABLE IF NOT EXISTS marketing_webhook_logs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id    UUID NOT NULL REFERENCES marketing_webhooks(id) ON DELETE CASCADE,
    event_type    VARCHAR(50),
    request_body  JSONB,
    response_code INTEGER,
    response_body TEXT,
    status        VARCHAR(50),
    created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== MARKETING_WEBHOOK_QUEUE =====================
CREATE TABLE IF NOT EXISTS marketing_webhook_queue (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id  UUID NOT NULL REFERENCES marketing_webhooks(id) ON DELETE CASCADE,
    event_type  VARCHAR(50),
    payload     JSONB,
    status      VARCHAR(50) DEFAULT 'pending',
    attempts    INTEGER DEFAULT 0,
    next_retry  TIMESTAMP WITHOUT TIME ZONE,
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- ============================================================================
-- Rush CRM â€” Collaboration / Workgroups (Teams, Channels, Posts, Wiki, Meetings)
-- File: 06_workgroup_tables.sql
-- ============================================================================

-- ===================== WORKGROUPS =====================
COMMENT ON TABLE workgroups IS 'Teams / workgroups for internal collaboration.';

CREATE TABLE IF NOT EXISTS workgroups (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name             VARCHAR(255) NOT NULL,
    description      TEXT,
    type             VARCHAR(50) DEFAULT 'team'
        CHECK (type IN ('team','department','project','workspace','custom')),
    avatar_url       VARCHAR(500),
    cover_image_url  VARCHAR(500),
    is_private       BOOLEAN DEFAULT false,
    is_archived      BOOLEAN DEFAULT false,
    member_count     INTEGER DEFAULT 0,
    message_count    INTEGER DEFAULT 0,
    settings         JSONB DEFAULT '{}',
    last_activity_at TIMESTAMP WITHOUT TIME ZONE,
    created_by       UUID REFERENCES users(id),
    created_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workgroups_org_id     ON workgroups (org_id);
CREATE INDEX IF NOT EXISTS idx_workgroups_type       ON workgroups (type);
CREATE INDEX IF NOT EXISTS idx_workgroups_created_at ON workgroups (created_at DESC);

-- Now add the deferred FK from deals â†’ workgroups
ALTER TABLE deals
    ADD CONSTRAINT deals_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES workgroups(id) ON DELETE SET NULL;


-- ===================== WORKGROUP_MEMBERS =====================
CREATE TABLE IF NOT EXISTS workgroup_members (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workgroup_id UUID NOT NULL REFERENCES workgroups(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         VARCHAR(50) DEFAULT 'member',
    invited_by   UUID REFERENCES users(id),
    joined_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (workgroup_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workgroup_members_workgroup_id ON workgroup_members (workgroup_id);
CREATE INDEX IF NOT EXISTS idx_workgroup_members_user_id      ON workgroup_members (user_id);
CREATE INDEX IF NOT EXISTS idx_workgroup_members_role         ON workgroup_members (role);


-- ===================== WORKGROUP_CHANNELS =====================
COMMENT ON TABLE workgroup_channels IS 'Discussion channels within a workgroup.';

CREATE TABLE IF NOT EXISTS workgroup_channels (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workgroup_id UUID NOT NULL REFERENCES workgroups(id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    description  TEXT,
    type         VARCHAR(50) DEFAULT 'standard',
    is_general   BOOLEAN DEFAULT false,
    is_archived  BOOLEAN DEFAULT false,
    created_by   UUID REFERENCES users(id),
    created_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (workgroup_id, name)
);

CREATE INDEX IF NOT EXISTS idx_workgroup_channels_workgroup_id ON workgroup_channels (workgroup_id);
CREATE INDEX IF NOT EXISTS idx_workgroup_channels_type         ON workgroup_channels (type);


-- ===================== WORKGROUP_POSTS =====================
COMMENT ON TABLE workgroup_posts IS 'Messages/posts in workgroup channels. Supports threads via parent_id.';

CREATE TABLE IF NOT EXISTS workgroup_posts (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workgroup_id UUID NOT NULL REFERENCES workgroups(id) ON DELETE CASCADE,
    channel_id   UUID REFERENCES workgroup_channels(id) ON DELETE CASCADE,
    user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
    parent_id    UUID REFERENCES workgroup_posts(id) ON DELETE CASCADE,
    content      TEXT NOT NULL,
    type         VARCHAR(50) DEFAULT 'message',
    attachments  JSONB DEFAULT '[]',
    reactions    JSONB DEFAULT '{}',
    is_pinned    BOOLEAN DEFAULT false,
    is_edited    BOOLEAN DEFAULT false,
    edited_at    TIMESTAMP WITHOUT TIME ZONE,
    created_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workgroup_posts_workgroup_id ON workgroup_posts (workgroup_id);
CREATE INDEX IF NOT EXISTS idx_workgroup_posts_channel_id   ON workgroup_posts (channel_id);
CREATE INDEX IF NOT EXISTS idx_workgroup_posts_parent_id    ON workgroup_posts (parent_id);
CREATE INDEX IF NOT EXISTS idx_workgroup_posts_created_at   ON workgroup_posts (created_at DESC);


-- ===================== WORKGROUP_FILES =====================
CREATE TABLE IF NOT EXISTS workgroup_files (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workgroup_id UUID NOT NULL REFERENCES workgroups(id) ON DELETE CASCADE,
    channel_id   UUID REFERENCES workgroup_channels(id) ON DELETE SET NULL,
    post_id      UUID REFERENCES workgroup_posts(id) ON DELETE SET NULL,
    file_name    VARCHAR(255) NOT NULL,
    file_url     VARCHAR(500) NOT NULL,
    file_size    INTEGER,
    mime_type    VARCHAR(100),
    uploaded_by  UUID REFERENCES users(id),
    created_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workgroup_files_workgroup_id ON workgroup_files (workgroup_id);
CREATE INDEX IF NOT EXISTS idx_workgroup_files_channel_id   ON workgroup_files (channel_id);
CREATE INDEX IF NOT EXISTS idx_workgroup_files_uploaded_by  ON workgroup_files (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_workgroup_files_created_at   ON workgroup_files (created_at DESC);


-- ===================== WORKGROUP_MEETINGS =====================
COMMENT ON TABLE workgroup_meetings IS 'Scheduled meetings within a workgroup or channel.';

CREATE TABLE IF NOT EXISTS workgroup_meetings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workgroup_id    UUID NOT NULL REFERENCES workgroups(id) ON DELETE CASCADE,
    channel_id      UUID REFERENCES workgroup_channels(id) ON DELETE SET NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    scheduled_start TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    scheduled_end   TIMESTAMP WITHOUT TIME ZONE,
    actual_start    TIMESTAMP WITHOUT TIME ZONE,
    actual_end      TIMESTAMP WITHOUT TIME ZONE,
    status          VARCHAR(50) DEFAULT 'scheduled',
    meeting_url     VARCHAR(500),
    meeting_type    VARCHAR(50),
    recording_url   VARCHAR(500),
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workgroup_meetings_workgroup_id    ON workgroup_meetings (workgroup_id);
CREATE INDEX IF NOT EXISTS idx_workgroup_meetings_scheduled_start ON workgroup_meetings (scheduled_start);
CREATE INDEX IF NOT EXISTS idx_workgroup_meetings_status          ON workgroup_meetings (status);


-- ===================== WORKGROUP_MEETING_PARTICIPANTS =====================
CREATE TABLE IF NOT EXISTS workgroup_meeting_participants (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES workgroup_meetings(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     VARCHAR(50) DEFAULT 'invited',
    joined_at  TIMESTAMP WITHOUT TIME ZONE,
    left_at    TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (meeting_id, user_id)
);


-- ===================== WORKGROUP_ACTIVITIES =====================
CREATE TABLE IF NOT EXISTS workgroup_activities (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workgroup_id  UUID NOT NULL REFERENCES workgroups(id) ON DELETE CASCADE,
    user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_type VARCHAR(100) NOT NULL,
    description   TEXT,
    metadata      JSONB DEFAULT '{}',
    created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workgroup_activities_workgroup_created ON workgroup_activities (workgroup_id, created_at DESC);


-- ===================== WORKGROUP_NOTIFICATIONS =====================
CREATE TABLE IF NOT EXISTS workgroup_notifications (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workgroup_id UUID,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        VARCHAR(255),
    message      TEXT,
    type         VARCHAR(50) DEFAULT 'info',
    is_read      BOOLEAN DEFAULT false,
    data         JSONB DEFAULT '{}',
    created_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at      TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_workgroup_notifications_workgroup_id ON workgroup_notifications (workgroup_id);
CREATE INDEX IF NOT EXISTS idx_workgroup_notifications_user_id      ON workgroup_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_workgroup_notifications_is_read      ON workgroup_notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_workgroup_notifications_created_at   ON workgroup_notifications (created_at DESC);


-- ===================== WORKGROUP_WIKI =====================
COMMENT ON TABLE workgroup_wiki IS 'Wiki knowledge base per workgroup (tree structure via parent_id).';

CREATE TABLE IF NOT EXISTS workgroup_wiki (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workgroup_id UUID NOT NULL REFERENCES workgroups(id) ON DELETE CASCADE,
    org_id       UUID,
    parent_id    UUID REFERENCES workgroup_wiki(id),
    title        VARCHAR(255) NOT NULL,
    content      TEXT,
    "order"      INTEGER DEFAULT 0,
    created_by   UUID REFERENCES users(id),
    updated_by   UUID REFERENCES users(id),
    created_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_workgroup_wiki_updated_at
    BEFORE UPDATE ON workgroup_wiki
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== WORKGROUP_WIKI_PAGES =====================
CREATE TABLE IF NOT EXISTS workgroup_wiki_pages (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workgroup_id     UUID NOT NULL REFERENCES workgroups(id) ON DELETE CASCADE,
    org_id           UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
    title            VARCHAR(255) NOT NULL,
    slug             VARCHAR(255),
    content          TEXT,
    is_published     BOOLEAN DEFAULT true,
    created_by       UUID REFERENCES users(id),
    last_modified_by UUID REFERENCES users(id),
    created_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (workgroup_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_workgroup_wiki_pages_workgroup_id ON workgroup_wiki_pages (workgroup_id);
CREATE INDEX IF NOT EXISTS idx_workgroup_wiki_pages_slug         ON workgroup_wiki_pages (workgroup_id, slug);


-- ===================== WORKGROUP TRIGGERS =====================
CREATE TRIGGER trigger_add_creator_as_owner
    AFTER INSERT ON workgroups
    FOR EACH ROW EXECUTE FUNCTION add_creator_as_owner();

CREATE TRIGGER trigger_create_default_channel
    AFTER INSERT ON workgroups
    FOR EACH ROW EXECUTE FUNCTION create_default_channel();

CREATE TRIGGER trigger_update_workgroup_member_count
    AFTER INSERT OR DELETE ON workgroup_members
    FOR EACH ROW EXECUTE FUNCTION update_workgroup_member_count();

CREATE TRIGGER trigger_update_workgroup_message_count
    AFTER INSERT OR DELETE ON workgroup_posts
    FOR EACH ROW EXECUTE FUNCTION update_workgroup_message_count();
-- ============================================================================
-- Rush CRM â€” Inventory / Operations Tables
-- File: 07_inventory_tables.sql
-- ============================================================================

-- ===================== WAREHOUSES =====================
COMMENT ON TABLE warehouses IS 'Physical or logical warehouses for stock storage.';

CREATE TABLE IF NOT EXISTS warehouses (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    code       VARCHAR(50),
    address    TEXT,
    city       VARCHAR(100),
    state      VARCHAR(100),
    country    VARCHAR(100),
    postal_code VARCHAR(20),
    type       VARCHAR(50) DEFAULT 'warehouse',
    is_active  BOOLEAN DEFAULT true,
    manager_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_warehouses_org_id ON warehouses (org_id);

CREATE TRIGGER update_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== INV_PRODUCTS =====================
COMMENT ON TABLE inv_products IS 'Product catalog for the inventory module.';

CREATE TABLE IF NOT EXISTS inv_products (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    sku                 VARCHAR(100),
    barcode             VARCHAR(100),
    description         TEXT,
    category            VARCHAR(100),
    subcategory         VARCHAR(100),
    brand               VARCHAR(100),
    unit                VARCHAR(50) DEFAULT 'piece',
    cost_price          NUMERIC(15,2),
    selling_price       NUMERIC(15,2),
    tax_rate            NUMERIC(5,2) DEFAULT 0,
    min_stock_level     INTEGER DEFAULT 0,
    max_stock_level     INTEGER,
    reorder_point       INTEGER DEFAULT 0,
    reorder_quantity    INTEGER,
    weight              NUMERIC(10,3),
    dimensions          JSONB,
    image_url           VARCHAR(500),
    images              JSONB DEFAULT '[]',
    is_active           BOOLEAN DEFAULT true,
    is_serialized       BOOLEAN DEFAULT false,
    custom_fields       JSONB DEFAULT '{}',
    tags                VARCHAR[] DEFAULT '{}',
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inv_products_org_id ON inv_products (org_id);
CREATE INDEX IF NOT EXISTS idx_inv_products_sku    ON inv_products (sku);

CREATE TRIGGER update_inv_products_updated_at
    BEFORE UPDATE ON inv_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ===================== STOCK =====================
COMMENT ON TABLE stock IS 'Per-warehouse stock levels for each product.';

CREATE TABLE IF NOT EXISTS stock (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id          UUID NOT NULL REFERENCES inv_products(id) ON DELETE CASCADE,
    warehouse_id        UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity            INTEGER DEFAULT 0,
    reserved_quantity   INTEGER DEFAULT 0,
    available_quantity  INTEGER DEFAULT 0,
    last_restocked      TIMESTAMP WITHOUT TIME ZONE,
    created_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_org_id      ON stock (org_id);
CREATE INDEX IF NOT EXISTS idx_stock_product_id  ON stock (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_warehouse_id ON stock (warehouse_id);

CREATE TRIGGER trigger_update_stock_available_quantity
    BEFORE INSERT OR UPDATE ON stock
    FOR EACH ROW EXECUTE FUNCTION update_stock_available_quantity();

CREATE TRIGGER trigger_log_stock_movement
    AFTER UPDATE ON stock
    FOR EACH ROW EXECUTE FUNCTION log_stock_movement();


-- ===================== STOCK_MOVEMENTS =====================
COMMENT ON TABLE stock_movements IS 'Audit trail for all stock quantity changes.';

CREATE TABLE IF NOT EXISTS stock_movements (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id    UUID NOT NULL REFERENCES inv_products(id) ON DELETE CASCADE,
    warehouse_id  UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL,     -- stock_in, stock_out, transfer, adjustment
    quantity      INTEGER NOT NULL,
    reference_type VARCHAR(50),
    reference_id  UUID,
    reason        TEXT,
    batch_number  VARCHAR(100),
    created_by    UUID REFERENCES users(id),
    created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_org_id      ON stock_movements (org_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id  ON stock_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_id ON stock_movements (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type        ON stock_movements (movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at  ON stock_movements (created_at);


-- ===================== INV_PURCHASE_ORDERS =====================
COMMENT ON TABLE inv_purchase_orders IS 'Purchase orders for restocking inventory.';

CREATE TABLE IF NOT EXISTS inv_purchase_orders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    po_number       VARCHAR(100) UNIQUE,
    supplier_id     UUID,
    warehouse_id    UUID REFERENCES warehouses(id),
    status          VARCHAR(50) DEFAULT 'draft',
    total_amount    NUMERIC(15,2) DEFAULT 0,
    tax_amount      NUMERIC(15,2) DEFAULT 0,
    shipping_cost   NUMERIC(15,2) DEFAULT 0,
    discount_amount NUMERIC(15,2) DEFAULT 0,
    grand_total     NUMERIC(15,2) DEFAULT 0,
    currency        VARCHAR(10) DEFAULT 'USD',
    order_date      DATE,
    expected_date   DATE,
    received_date   DATE,
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inv_purchase_orders_org_id ON inv_purchase_orders (org_id);


-- ===================== INV_PURCHASE_ORDER_ITEMS =====================
CREATE TABLE IF NOT EXISTS inv_purchase_order_items (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES inv_purchase_orders(id) ON DELETE CASCADE,
    product_id        UUID NOT NULL REFERENCES inv_products(id),
    quantity          INTEGER NOT NULL,
    unit_price        NUMERIC(15,2) NOT NULL,
    total_price       NUMERIC(15,2),
    received_quantity INTEGER DEFAULT 0,
    created_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== INV_SUPPLIERS =====================
COMMENT ON TABLE inv_suppliers IS 'Vendor / supplier records for purchasing.';

CREATE TABLE IF NOT EXISTS inv_suppliers (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email          VARCHAR(255),
    phone          VARCHAR(50),
    address        TEXT,
    city           VARCHAR(100),
    country        VARCHAR(100),
    website        VARCHAR(255),
    payment_terms  VARCHAR(100),
    notes          TEXT,
    is_active      BOOLEAN DEFAULT true,
    created_at     TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== INV_ADJUSTMENTS =====================
COMMENT ON TABLE inv_adjustments IS 'Inventory level adjustments (corrections, write-offs, etc.).';

CREATE TABLE IF NOT EXISTS inv_adjustments (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    warehouse_id  UUID NOT NULL REFERENCES warehouses(id),
    adjustment_number VARCHAR(100),
    reason        TEXT,
    status        VARCHAR(50) DEFAULT 'draft',
    notes         TEXT,
    adjusted_by   UUID REFERENCES users(id),
    created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== INV_ADJUSTMENT_ITEMS =====================
CREATE TABLE IF NOT EXISTS inv_adjustment_items (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    adjustment_id UUID NOT NULL REFERENCES inv_adjustments(id) ON DELETE CASCADE,
    product_id    UUID NOT NULL REFERENCES inv_products(id),
    old_quantity  INTEGER,
    new_quantity  INTEGER,
    difference    INTEGER,
    reason        TEXT,
    created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- ============================================================================
-- Rush CRM â€” Drive, Workflows, Audit Logs, Misc Tables
-- File: 08_drive_and_misc_tables.sql
-- ============================================================================

-- ===================== DRIVE_FOLDERS =====================
COMMENT ON TABLE drive_folders IS 'Cloud drive folder hierarchy per organization.';

CREATE TABLE IF NOT EXISTS drive_folders (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    parent_id       UUID REFERENCES drive_folders(id) ON DELETE CASCADE,
    description     TEXT,
    color           VARCHAR(50),
    is_shared       BOOLEAN DEFAULT false,
    path            TEXT,
    owner_id        UUID REFERENCES users(id),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT drive_folders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT drive_folders_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_drive_folders_parent ON drive_folders (parent_id);
CREATE INDEX IF NOT EXISTS idx_drive_folders_org    ON drive_folders (org_id);


-- ===================== DRIVE_FILES =====================
COMMENT ON TABLE drive_files IS 'Files stored in the cloud drive.';

CREATE TABLE IF NOT EXISTS drive_files (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    folder_id       UUID REFERENCES drive_folders(id) ON DELETE SET NULL,
    name            VARCHAR(255) NOT NULL,
    original_name   VARCHAR(255),
    file_url        VARCHAR(500) NOT NULL,
    file_size       INTEGER,
    mime_type       VARCHAR(100),
    extension       VARCHAR(20),
    description     TEXT,
    tags            VARCHAR[] DEFAULT '{}',
    is_starred      BOOLEAN DEFAULT false,
    is_trashed      BOOLEAN DEFAULT false,
    trashed_at      TIMESTAMP WITHOUT TIME ZONE,
    version         INTEGER DEFAULT 1,
    thumbnail_url   VARCHAR(500),
    metadata        JSONB DEFAULT '{}',
    owner_id        UUID REFERENCES users(id),
    uploaded_by     UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT drive_files_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT drive_files_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_drive_files_folder ON drive_files (folder_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_org    ON drive_files (org_id);


-- ===================== DRIVE_SHARES =====================
COMMENT ON TABLE drive_shares IS 'File/folder share permissions for drive items.';

CREATE TABLE IF NOT EXISTS drive_shares (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
    file_id     UUID REFERENCES drive_files(id) ON DELETE CASCADE,
    folder_id   UUID REFERENCES drive_folders(id) ON DELETE CASCADE,
    shared_with UUID REFERENCES users(id) ON DELETE CASCADE,
    permission  VARCHAR(50) DEFAULT 'view',
    shared_by   UUID REFERENCES users(id),
    expires_at  TIMESTAMP WITHOUT TIME ZONE,
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== WORKFLOW_DEFINITIONS =====================
COMMENT ON TABLE workflow_definitions IS 'Automation workflow definitions (approval flows, notifications, etc.).';

CREATE TABLE IF NOT EXISTS workflow_definitions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    trigger_type    VARCHAR(50),
    trigger_config  JSONB DEFAULT '{}',
    steps           JSONB DEFAULT '[]',
    is_active       BOOLEAN DEFAULT true,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT workflow_definitions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT workflow_definitions_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);


-- ===================== WORKFLOW_INSTANCES =====================
CREATE TABLE IF NOT EXISTS workflow_instances (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id   UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    entity_type   VARCHAR(50),
    entity_id     UUID,
    status        VARCHAR(50) DEFAULT 'running',
    current_step  INTEGER DEFAULT 0,
    context       JSONB DEFAULT '{}',
    started_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at  TIMESTAMP WITHOUT TIME ZONE,
    created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ===================== AUDIT_LOGS =====================
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for security-relevant actions.';

CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    user_id         UUID,
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       UUID,
    old_values      JSONB,
    new_values      JSONB,
    ip_address      VARCHAR(50),
    user_agent      TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT audit_logs_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user   ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date   ON audit_logs (created_at);


-- ===================== SETTINGS =====================
COMMENT ON TABLE settings IS 'Application-level and org-level key-value configuration.';

CREATE TABLE IF NOT EXISTS settings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    key             VARCHAR(255) NOT NULL,
    value           TEXT,
    type            VARCHAR(50) DEFAULT 'string',
    category        VARCHAR(100),
    description     TEXT,
    is_system       BOOLEAN DEFAULT false,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT settings_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);


-- ===================== TAGS =====================
COMMENT ON TABLE tags IS 'Reusable tags scoped to an organization.';

CREATE TABLE IF NOT EXISTS tags (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    name            VARCHAR(100) NOT NULL,
    color           VARCHAR(50),
    category        VARCHAR(50),
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT tags_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT tags_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);


-- ===================== EMAIL_SETTINGS =====================
COMMENT ON TABLE email_settings IS 'SMTP and email configuration per organization.';

CREATE TABLE IF NOT EXISTS email_settings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    provider        VARCHAR(50),              -- smtp, sendgrid, ses
    smtp_host       VARCHAR(255),
    smtp_port       INTEGER,
    smtp_user       VARCHAR(255),
    smtp_password   VARCHAR(255),
    from_name       VARCHAR(255),
    from_email      VARCHAR(255),
    is_active       BOOLEAN DEFAULT false,
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT email_settings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT email_settings_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);


-- ===================== CUSTOM_FIELDS =====================
COMMENT ON TABLE custom_fields IS 'User-defined custom field definitions per entity type.';

CREATE TABLE IF NOT EXISTS custom_fields (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,
    org_id          UUID,
    entity_type     VARCHAR(50) NOT NULL,     -- lead, deal, contact, customer
    field_name      VARCHAR(100) NOT NULL,
    field_type      VARCHAR(50) NOT NULL,     -- text, number, date, select, multi_select
    field_label     VARCHAR(255),
    options         JSONB DEFAULT '[]',
    is_required     BOOLEAN DEFAULT false,
    default_value   TEXT,
    "order"         INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT custom_fields_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT custom_fields_org_id_fkey          FOREIGN KEY (org_id)          REFERENCES organizations(id) ON DELETE CASCADE
);
-- ============================================================================
-- Rush CRM â€” Car Inventory Management Module
-- File: 09_car_inventory_tables.sql
-- Description: Full car dealership management â€” workspaces, inventory,
--              inquiries, test drives, sales, service history.
-- ============================================================================

-- ===================== CAR_WORKSPACES =====================
COMMENT ON TABLE car_workspaces IS 'Separate workspaces for different dealerships/branches.';

CREATE TABLE IF NOT EXISTS car_workspaces (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    description    TEXT,
    workspace_type VARCHAR(50) DEFAULT 'dealership',
    address        TEXT,
    city           VARCHAR(100),
    state          VARCHAR(100),
    country        VARCHAR(100),
    phone          VARCHAR(50),
    email          VARCHAR(255),
    is_active      BOOLEAN DEFAULT true,
    settings       JSONB DEFAULT '{}',
    created_by     UUID,
    created_at     TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_car_workspaces_org    ON car_workspaces (org_id);
CREATE INDEX IF NOT EXISTS idx_car_workspaces_active ON car_workspaces (is_active);

CREATE TRIGGER car_workspaces_updated_at
    BEFORE UPDATE ON car_workspaces
    FOR EACH ROW EXECUTE FUNCTION update_car_updated_at();


-- ===================== CAR_INVENTORY =====================
COMMENT ON TABLE car_inventory IS 'Main car inventory with all vehicle details.';

CREATE TABLE IF NOT EXISTS car_inventory (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id            UUID NOT NULL,
    workspace_id      UUID NOT NULL REFERENCES car_workspaces(id) ON DELETE CASCADE,
    -- Vehicle basics
    stock_number      VARCHAR(100),
    vin               VARCHAR(17) UNIQUE,
    year              INTEGER NOT NULL,
    make              VARCHAR(100) NOT NULL,
    model             VARCHAR(100) NOT NULL,
    trim_level        VARCHAR(100),
    body_type         VARCHAR(50),
    -- Appearance
    exterior_color    VARCHAR(100),
    interior_color    VARCHAR(100),
    -- Engine & performance
    engine_type       VARCHAR(100),
    engine_size       VARCHAR(50),
    fuel_type         VARCHAR(50),
    transmission      VARCHAR(50),
    drivetrain        VARCHAR(50),
    horsepower        INTEGER,
    torque            VARCHAR(50),
    -- Details
    mileage           INTEGER,
    doors             INTEGER DEFAULT 4,
    seats             INTEGER DEFAULT 5,
    condition         VARCHAR(50) DEFAULT 'used',
    -- Pricing
    purchase_price    NUMERIC(12,2),
    selling_price     NUMERIC(12,2),
    msrp              NUMERIC(12,2),
    internet_price    NUMERIC(12,2),
    -- Status
    status            VARCHAR(50) DEFAULT 'available',
    -- Features
    features          JSONB DEFAULT '[]',
    safety_features   JSONB DEFAULT '[]',
    -- Media
    images            JSONB DEFAULT '[]',
    primary_image     VARCHAR(500),
    video_url         VARCHAR(500),
    -- Description
    description       TEXT,
    seller_notes      TEXT,
    -- Dates
    acquired_date     DATE,
    listed_date       DATE,
    sold_date         DATE,
    -- History
    previous_owners   INTEGER,
    accident_history  BOOLEAN DEFAULT false,
    title_status      VARCHAR(50),
    -- Location
    lot_location      VARCHAR(255),
    -- Meta
    views_count       INTEGER DEFAULT 0,
    inquiries_count   INTEGER DEFAULT 0,
    tags              JSONB DEFAULT '[]',
    custom_fields     JSONB DEFAULT '{}',
    created_by        UUID,
    created_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_car_inventory_workspace ON car_inventory (workspace_id);
CREATE INDEX IF NOT EXISTS idx_car_inventory_status    ON car_inventory (status);
CREATE INDEX IF NOT EXISTS idx_car_inventory_make      ON car_inventory (make);
CREATE INDEX IF NOT EXISTS idx_car_inventory_year      ON car_inventory (year);
CREATE INDEX IF NOT EXISTS idx_car_inventory_price     ON car_inventory (selling_price);

CREATE TRIGGER car_inventory_updated_at
    BEFORE UPDATE ON car_inventory
    FOR EACH ROW EXECUTE FUNCTION update_car_updated_at();


-- ===================== CAR_IMAGES =====================
COMMENT ON TABLE car_images IS 'Individual image records for car inventory items.';

CREATE TABLE IF NOT EXISTS car_images (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    car_id      UUID NOT NULL REFERENCES car_inventory(id) ON DELETE CASCADE,
    image_url   VARCHAR(500) NOT NULL,
    caption     VARCHAR(255),
    sort_order  INTEGER DEFAULT 0,
    is_primary  BOOLEAN DEFAULT false,
    created_at  TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_car_images_car_id ON car_images (car_id);


-- ===================== CAR_INQUIRIES =====================
COMMENT ON TABLE car_inquiries IS 'Customer inquiries about specific cars.';

CREATE TABLE IF NOT EXISTS car_inquiries (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id            UUID NOT NULL,
    workspace_id      UUID NOT NULL REFERENCES car_workspaces(id) ON DELETE CASCADE,
    car_id            UUID REFERENCES car_inventory(id) ON DELETE SET NULL,
    -- Customer info
    customer_name     VARCHAR(255) NOT NULL,
    customer_email    VARCHAR(255),
    customer_phone    VARCHAR(50) NOT NULL,
    contact_id        UUID,
    -- Inquiry details
    inquiry_type      VARCHAR(50) DEFAULT 'general',
    source            VARCHAR(100),
    message           TEXT,
    -- Status
    status            VARCHAR(50) DEFAULT 'new',
    priority          VARCHAR(50) DEFAULT 'medium',
    -- Assignment
    assigned_to       UUID,
    -- Follow up
    follow_up_date    TIMESTAMP WITHOUT TIME ZONE,
    response          TEXT,
    responded_at      TIMESTAMP WITHOUT TIME ZONE,
    -- Metadata
    notes             TEXT,
    tags              JSONB DEFAULT '[]',
    created_by        UUID,
    created_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_car_inquiries_workspace ON car_inquiries (workspace_id);
CREATE INDEX IF NOT EXISTS idx_car_inquiries_car       ON car_inquiries (car_id);
CREATE INDEX IF NOT EXISTS idx_car_inquiries_status    ON car_inquiries (status);

CREATE TRIGGER car_inquiries_updated_at
    BEFORE UPDATE ON car_inquiries
    FOR EACH ROW EXECUTE FUNCTION update_car_updated_at();


-- ===================== CAR_TEST_DRIVES =====================
COMMENT ON TABLE car_test_drives IS 'Test drive bookings and history.';

CREATE TABLE IF NOT EXISTS car_test_drives (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id            UUID NOT NULL,
    workspace_id      UUID NOT NULL REFERENCES car_workspaces(id) ON DELETE CASCADE,
    car_id            UUID NOT NULL REFERENCES car_inventory(id) ON DELETE RESTRICT,
    inquiry_id        UUID REFERENCES car_inquiries(id) ON DELETE SET NULL,
    -- Customer info
    customer_name     VARCHAR(255) NOT NULL,
    customer_email    VARCHAR(255),
    customer_phone    VARCHAR(50) NOT NULL,
    customer_license  VARCHAR(100),
    contact_id        UUID,
    -- Schedule
    scheduled_date    DATE NOT NULL,
    scheduled_time    TIME NOT NULL,
    duration_minutes  INTEGER DEFAULT 30,
    -- Status
    status            VARCHAR(50) DEFAULT 'scheduled',
    -- Details
    start_mileage     INTEGER,
    end_mileage       INTEGER,
    route_taken       TEXT,
    sales_rep         UUID,
    notes             TEXT,
    customer_feedback TEXT,
    interested_level  VARCHAR(50),
    -- Follow up
    follow_up_required BOOLEAN DEFAULT true,
    follow_up_date    DATE,
    -- Metadata
    created_by        UUID,
    created_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at      TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_car_test_drives_workspace ON car_test_drives (workspace_id);
CREATE INDEX IF NOT EXISTS idx_car_test_drives_car       ON car_test_drives (car_id);
CREATE INDEX IF NOT EXISTS idx_car_test_drives_date      ON car_test_drives (scheduled_date);
CREATE INDEX IF NOT EXISTS idx_car_test_drives_status    ON car_test_drives (status);

CREATE TRIGGER car_test_drives_updated_at
    BEFORE UPDATE ON car_test_drives
    FOR EACH ROW EXECUTE FUNCTION update_car_updated_at();


-- ===================== CAR_SALES =====================
COMMENT ON TABLE car_sales IS 'Completed car sales transactions.';

CREATE TABLE IF NOT EXISTS car_sales (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id            UUID NOT NULL,
    workspace_id      UUID NOT NULL REFERENCES car_workspaces(id) ON DELETE CASCADE,
    car_id            UUID NOT NULL REFERENCES car_inventory(id) ON DELETE RESTRICT,
    -- Sale info
    sale_number       VARCHAR(100) UNIQUE,
    sale_date         DATE NOT NULL,
    -- Customer
    customer_name     VARCHAR(255) NOT NULL,
    customer_email    VARCHAR(255),
    customer_phone    VARCHAR(50),
    customer_address  TEXT,
    contact_id        UUID,
    -- Pricing
    sale_price        NUMERIC(12,2) NOT NULL,
    down_payment      NUMERIC(12,2) DEFAULT 0,
    trade_in_value    NUMERIC(12,2) DEFAULT 0,
    trade_in_vehicle  VARCHAR(255),
    financing_amount  NUMERIC(12,2) DEFAULT 0,
    financing_term    INTEGER,
    interest_rate     NUMERIC(5,2),
    monthly_payment   NUMERIC(12,2),
    -- Fees & taxes
    tax_amount        NUMERIC(12,2) DEFAULT 0,
    registration_fee  NUMERIC(12,2) DEFAULT 0,
    documentation_fee NUMERIC(12,2) DEFAULT 0,
    other_fees        NUMERIC(12,2) DEFAULT 0,
    total_amount      NUMERIC(12,2) NOT NULL,
    -- Payment
    payment_method    VARCHAR(50),
    payment_status    VARCHAR(50) DEFAULT 'pending',
    amount_paid       NUMERIC(12,2) DEFAULT 0,
    balance_due       NUMERIC(12,2),
    -- Delivery
    delivery_date     DATE,
    delivery_status   VARCHAR(50) DEFAULT 'pending',
    -- Staff
    sales_rep         UUID,
    finance_manager   UUID,
    -- Documents
    contract_signed   BOOLEAN DEFAULT false,
    contract_url      VARCHAR(500),
    -- Notes
    notes             TEXT,
    -- Metadata
    created_by        UUID,
    created_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_car_sales_workspace ON car_sales (workspace_id);
CREATE INDEX IF NOT EXISTS idx_car_sales_car       ON car_sales (car_id);
CREATE INDEX IF NOT EXISTS idx_car_sales_date      ON car_sales (sale_date);
CREATE INDEX IF NOT EXISTS idx_car_sales_status    ON car_sales (payment_status);

CREATE TRIGGER car_sales_updated_at
    BEFORE UPDATE ON car_sales
    FOR EACH ROW EXECUTE FUNCTION update_car_updated_at();


-- ===================== CAR_SERVICE_HISTORY =====================
COMMENT ON TABLE car_service_history IS 'Service and maintenance history for each car.';

CREATE TABLE IF NOT EXISTS car_service_history (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID NOT NULL,
    car_id              UUID NOT NULL REFERENCES car_inventory(id) ON DELETE CASCADE,
    service_date        DATE NOT NULL,
    service_type        VARCHAR(100) NOT NULL,
    description         TEXT NOT NULL,
    mileage_at_service  INTEGER,
    cost                NUMERIC(10,2),
    service_provider    VARCHAR(255),
    invoice_number      VARCHAR(100),
    next_service_due    DATE,
    next_service_mileage INTEGER,
    performed_by        UUID,
    notes               TEXT,
    created_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_car_service_car  ON car_service_history (car_id);
CREATE INDEX IF NOT EXISTS idx_car_service_date ON car_service_history (service_date);


-- ===================== CAR_WORKSPACE_MEMBERS =====================
COMMENT ON TABLE car_workspace_members IS 'Users assigned to specific car workspaces.';

CREATE TABLE IF NOT EXISTS car_workspace_members (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES car_workspaces(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL,
    role         VARCHAR(50) DEFAULT 'member',
    permissions  JSONB DEFAULT '{}',
    created_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_car_workspace_members_workspace ON car_workspace_members (workspace_id);
CREATE INDEX IF NOT EXISTS idx_car_workspace_members_user      ON car_workspace_members (user_id);


-- ===================== CAR_ACTIVITY_LOG =====================
COMMENT ON TABLE car_activity_log IS 'Activity tracking for car dealership audit trail.';

CREATE TABLE IF NOT EXISTS car_activity_log (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id        UUID NOT NULL,
    workspace_id  UUID REFERENCES car_workspaces(id) ON DELETE CASCADE,
    car_id        UUID REFERENCES car_inventory(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL,
    description   TEXT NOT NULL,
    changes       JSONB,
    user_id       UUID,
    user_name     VARCHAR(255),
    created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_car_activity_workspace ON car_activity_log (workspace_id);
CREATE INDEX IF NOT EXISTS idx_car_activity_car       ON car_activity_log (car_id);
CREATE INDEX IF NOT EXISTS idx_car_activity_type      ON car_activity_log (activity_type);
CREATE INDEX IF NOT EXISTS idx_car_activity_date      ON car_activity_log (created_at);

-- ===================== VIEWS =====================
CREATE OR REPLACE VIEW public.workgroup_stats AS
 SELECT w.id, w.name, w.type, w.is_private, w.member_count, w.message_count, w.last_activity_at,
    count(DISTINCT wm.user_id) AS actual_member_count,
    count(DISTINCT wp.id) AS actual_message_count,
    max(wp.created_at) AS last_message_at
   FROM ((public.workgroups w
     LEFT JOIN public.workgroup_members wm ON ((w.id = wm.workgroup_id)))
     LEFT JOIN public.workgroup_posts wp ON ((w.id = wp.workgroup_id)))
  GROUP BY w.id, w.name, w.type, w.is_private, w.member_count, w.message_count, w.last_activity_at;

COMMENT ON VIEW public.workgroup_stats IS 'Aggregated statistics for workgroups including member and message counts.';

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';

CREATE FUNCTION add_creator_as_owner() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO workgroup_members (workgroup_id, user_id, role, joined_at)
    VALUES (NEW.id, NEW.created_by, 'owner', CURRENT_TIMESTAMP);
    RETURN NEW;
END;
$$;

--
-- Name: create_default_channel(); Type: FUNCTION; Schema: public;
--

CREATE FUNCTION create_default_channel() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO workgroup_channels (workgroup_id, name, description, type, is_general, created_by)
    VALUES (NEW.id, 'General', 'General discussion for the team', 'standard', true, NEW.created_by);
    RETURN NEW;
END;
$$;


--
-- Name: log_stock_movement(); Type: FUNCTION; Schema: public;
--

CREATE FUNCTION log_stock_movement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        IF OLD.quantity != NEW.quantity THEN
          INSERT INTO stock_movements (
            org_id, product_id, warehouse_id, movement_type, quantity, reason, created_by
          ) VALUES (
            NEW.org_id, 
            NEW.product_id, 
            NEW.warehouse_id,
            CASE 
              WHEN NEW.quantity > OLD.quantity THEN 'stock_in'
              ELSE 'stock_out'
            END,
            ABS(NEW.quantity - OLD.quantity),
            'Stock updated',
            (SELECT id FROM users LIMIT 1)
          );
        END IF;
        RETURN NEW;
      END;
      $$;



--
-- Name: update_leave_remaining_days(); Type: FUNCTION; Schema: public;
--

CREATE FUNCTION update_leave_remaining_days() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.remaining_days = NEW.total_days - NEW.used_days;
    RETURN NEW;
END;
$$;



--
-- Name: update_stock_available_quantity(); Type: FUNCTION; Schema: public;
--

CREATE FUNCTION update_stock_available_quantity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.available_quantity = NEW.quantity - NEW.reserved_quantity;
    RETURN NEW;
END;
$$;



--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public;
--

CREATE FUNCTION update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;



--
-- Name: update_workgroup_member_count(); Type: FUNCTION; Schema: public;
--

CREATE FUNCTION update_workgroup_member_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE workgroups 
        SET member_count = member_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.workgroup_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE workgroups 
        SET member_count = member_count - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.workgroup_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

--
-- Name: update_workgroup_message_count(); Type: FUNCTION; Schema: public;
--

CREATE FUNCTION update_workgroup_message_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
        SET message_count = message_count - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.workgroup_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;



SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activities; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS activities (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    type character varying(50) NOT NULL,
    subject character varying(255),
    description text,
    contact_id uuid,
    deal_id uuid,
    company_id uuid,
    assigned_to uuid,
    due_date timestamp without time zone,
    completed boolean DEFAULT false,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    owner_id uuid,
    lead_id uuid
);



--
-- Name: attendance; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS attendance (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    employee_id uuid,
    date date NOT NULL,
    check_in timestamp without time zone,
    check_out timestamp without time zone,
    status character varying(50) DEFAULT 'present'::character varying,
    hours_worked numeric(5,2),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    total_hours numeric(5,2),
    clock_in timestamp without time zone,
    clock_out timestamp without time zone,
    late_minutes integer DEFAULT 0,
    overtime_hours numeric(5,2) DEFAULT 0,
    location character varying(255),
    created_by uuid,
    updated_by uuid,
    break_duration integer DEFAULT 0,
    ip_address character varying(50),
    device_info text,
    user_id uuid,
    location_lat numeric,
    location_lng numeric,
    break_end timestamp without time zone,
    break_start timestamp without time zone
);



--
-- Name: calendar_event_attendees; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS calendar_event_attendees (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    event_id uuid,
    user_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    email text,
    is_organizer boolean DEFAULT false,
    org_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: calendar_connections; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS calendar_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    user_id uuid,
    provider character varying(50) NOT NULL,
    calendar_name character varying(255),
    external_calendar_id character varying(255),
    access_token text,
    refresh_token text,
    expires_at timestamp without time zone,
    is_primary boolean DEFAULT false,
    last_sync_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT calendar_connections_unique_user_provider UNIQUE(org_id, user_id, provider)
);



--
-- Name: calendar_events; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS calendar_events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    title character varying(255) NOT NULL,
    description text,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    location character varying(255),
    event_type character varying(50) DEFAULT 'meeting'::character varying,
    is_all_day boolean DEFAULT false,
    recurrence_rule character varying(255),
    reminder_minutes integer,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    color character varying(20),
    is_recurring boolean DEFAULT false,
    attendees jsonb DEFAULT '[]'::jsonb,
    attachments jsonb DEFAULT '[]'::jsonb,
    external_calendar_id character varying(255),
    external_provider character varying(50),
    CONSTRAINT calendar_events_external_id_unique UNIQUE(external_calendar_id)
);



--
-- Name: call_logs; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS call_logs (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    contact_id uuid,
    user_id uuid,
    call_type character varying(50) NOT NULL,
    direction character varying(50) NOT NULL,
    phone_number character varying(50) NOT NULL,
    duration integer DEFAULT 0,
    status character varying(50),
    recording_url character varying(500),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: companies; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS companies (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    industry character varying(100),
    website character varying(255),
    phone character varying(50),
    email character varying(255),
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(100),
    postal_code character varying(20),
    employee_count integer,
    annual_revenue numeric(15,2),
    description text,
    logo_url character varying(500),
    status character varying(50) DEFAULT 'active'::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    revenue numeric(15,2),
    notes text,
    org_id uuid,
    owner_id uuid,
    linkedin_url character varying(255)
);



--
-- Name: connected_drives; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS connected_drives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    ownership character varying(50) NOT NULL,
    drive_type character varying(50) NOT NULL,
    display_name character varying(255) NOT NULL,
    network_path text,
    network_protocol character varying(50),
    connected_by uuid,
    settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: connected_mailboxes; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS connected_mailboxes (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    org_id uuid,
    user_id uuid,
    provider character varying(50) NOT NULL,
    email_address character varying(255) NOT NULL,
    display_name character varying(255),
    access_token text,
    refresh_token text,
    token_expires_at timestamp without time zone,
    imap_host character varying(255),
    imap_port integer,
    smtp_host character varying(255),
    smtp_port integer,
    imap_username character varying(255),
    smtp_username character varying(255),
    encrypted_password text,
    is_active boolean DEFAULT true,
    sync_status character varying(50) DEFAULT 'pending'::character varying,
    last_sync_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: contacts; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS contacts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    first_name character varying(100),
    last_name character varying(100),
    email character varying(255),
    phone character varying(50),
    company character varying(255),
    job_title character varying(100),
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(100),
    postal_code character varying(20),
    website character varying(255),
    source character varying(100),
    status character varying(50) DEFAULT 'active'::character varying,
    tags text[],
    notes text,
    last_contacted timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_name character varying(255),
    linkedin_url character varying(255),
    twitter_url character varying(255),
    score integer DEFAULT 0,
    "position" character varying(255),
    contact_type character varying(50) DEFAULT 'contact'::character varying,
    messenger character varying(255),
    available_to_everyone boolean DEFAULT true,
    included_in_export boolean DEFAULT true,
    second_name character varying(255),
    salutation character varying(50),
    dob date,
    photo_url text,
    website_type character varying(50),
    messenger_type character varying(50),
    source_info text,
    is_public boolean DEFAULT true,
    include_in_export boolean DEFAULT true,
    responsible_id uuid,
    observers uuid[],
    org_id uuid,
    lifecycle_stage character varying(50),
    owner_id uuid,
    lead_source character varying(100),
    company_id uuid,
    user_id uuid
);



--
-- Name: crm_activities; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS crm_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid,
    entity_type character varying(50),
    entity_id uuid,
    activity_type character varying(100),
    title character varying(255),
    description text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: crm_comments; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS crm_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    content text NOT NULL,
    is_edited boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_documents; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS crm_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path text NOT NULL,
    mime_type character varying(100),
    file_size bigint,
    provider character varying(50) DEFAULT 'local'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: customers; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS customers (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    contact_id uuid,
    company_id uuid,
    user_id uuid,
    name character varying(255),
    email character varying(255),
    phone character varying(50),
    tier character varying(50),
    customer_type character varying(50) DEFAULT 'individual'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    lifetime_value numeric(15,2) DEFAULT 0,
    total_revenue numeric(15,2) DEFAULT 0,
    total_purchases integer DEFAULT 0,
    first_purchase_date date,
    last_purchase_date date,
    notes text,
    tags jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    industry character varying(100),
    lead_id uuid,
    deal_id uuid,
    converted_from_lead_id uuid,
    converted_from_deal_id uuid,
    org_id uuid
);



--
-- Name: deal_contacts; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS deal_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    deal_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    role character varying(100),
    primary_contact boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: deal_signing_parties; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS deal_signing_parties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    deal_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    role character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: deals; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS deals (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    title character varying(255) NOT NULL,
    lead_id uuid REFERENCES leads(id) ON DELETE SET NULL;
    description text,
    value numeric(15,2),
    currency character varying(10) DEFAULT 'USD'::character varying,
    stage character varying(100) DEFAULT 'qualification'::character varying,
    probability integer DEFAULT 0,
    expected_close_date date,
    contact_id uuid,
    company_id uuid,
    assigned_to uuid,
    status character varying(50) DEFAULT 'open'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    closed_at timestamp without time zone,
    source character varying(100),
    campaign_id uuid,
    utm_source character varying(100),
    utm_medium character varying(100),
    utm_campaign character varying(100),
    org_id uuid,
    converted_from_lead_id uuid,
    converted_to_customer_id uuid,
    contact_name text,
    company_name text,
    phone text,
    email text,
    priority text DEFAULT 'medium'::text,
    designation text,
    website text,
    address text,
    company_phone text,
    company_email text,
    company_size text,
    agent_name text,
    decision_maker text,
    service_interested text,
    interaction_notes text,
    first_message text,
    last_touch timestamp with time zone,
    external_source_id text,
    workspace_id uuid,
    source_info text,
    phone_type text DEFAULT 'work'::text,
    email_type text DEFAULT 'work'::text,
    website_type text DEFAULT 'corporate'::text,
    customer_type text,
    last_contacted_date date,
    next_follow_up_date date,
    responsible_person uuid,
    owner_id uuid,
    lost_reason text,
    won_at timestamp without time zone,
    lost_at timestamp without time zone,
    user_id uuid,
    linked_company_name character varying(255),
    linked_company_phone character varying(50),
    linked_company_email character varying(255),
    contact_first_name character varying(255),
    contact_last_name character varying(255),
    contact_email character varying(255),
    contact_phone character varying(50),
    tags text[],
    available_to_everyone boolean DEFAULT true,
    client_type text,
    project_type text,
    scope text,
    feedback text,
    feedback_details text,
    payment_method text,
    invoice_link text,
    qa_status text,
    quotation_received text,
    hours_of_work text,
    hourly_rate numeric(10,2),
    hourly_rate_currency text DEFAULT 'USD'::text,
    proposal_amount numeric(15,2),
    proposal_currency text DEFAULT 'USD'::text,
    invoice_amount numeric(15,2),
    invoice_currency text DEFAULT 'USD'::text,
    project_blueprints jsonb DEFAULT '[]'::jsonb,
    custom_fields jsonb DEFAULT '{}'::jsonb
);



--
-- Name: COLUMN deals.description; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN deals.description IS 'Detailed description of the deal';


--
-- Name: COLUMN deals.source; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN deals.source IS 'Lead source: website, referral, linkedin, etc.';


--
-- Name: COLUMN deals.contact_name; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN deals.contact_name IS 'Name of the primary contact person';


--
-- Name: COLUMN deals.company_name; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN deals.company_name IS 'Name of the company';


--
-- Name: COLUMN deals.phone; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN deals.phone IS 'Contact phone number';


--
-- Name: COLUMN deals.email; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN deals.email IS 'Contact email address';


--
-- Name: COLUMN deals.priority; Type: COMMENT; Schema: public
--

COMMENT ON COLUMN deals.priority IS 'Deal priority: low, medium, high, urgent';


--
-- Name: drive_activities; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS drive_activities (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    org_id uuid,
    user_id uuid,
    file_id uuid,
    folder_id uuid,
    activity_type character varying(50) NOT NULL,
    activity_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: drive_file_versions; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS drive_file_versions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    file_id uuid,
    version_number integer NOT NULL,
    file_path character varying(1000),
    file_size bigint,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: drive_files; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS drive_files (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    file_url character varying(500) NOT NULL,
    file_size integer,
    file_type character varying(100),
    folder_path character varying(500) DEFAULT '/'::character varying,
    is_public boolean DEFAULT false,
    shared_with uuid[],
    uploaded_by uuid,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    folder_id uuid,
    size bigint DEFAULT 0,
    mime_type character varying(255),
    is_folder boolean DEFAULT false,
    parent_id uuid,
    path character varying(1000),
    original_name character varying(500),
    file_path character varying(1000),
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    version integer DEFAULT 1,
    is_starred boolean DEFAULT false,
    permissions jsonb DEFAULT '{}'::jsonb
);



--
-- Name: drive_folders; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS drive_folders (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    org_id uuid,
    name character varying(255) NOT NULL,
    parent_id uuid,
    path character varying(1000),
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    parent_folder_id uuid,
    color character varying(50) DEFAULT 'folder-blue'::character varying,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone
);



--
-- Name: drive_permissions; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS drive_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    drive_id uuid,
    org_id uuid,
    user_id uuid,
    role uuid,
    access_level character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: emails; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS emails (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    user_id uuid,
    mailbox_id uuid,
    from_email character varying(255) NOT NULL,
    to_email character varying(255) NOT NULL,
    cc_email text,
    bcc_email text,
    subject character varying(500),
    body text,
    html_body text,
    snippet text,
    is_read boolean DEFAULT false,
    is_starred boolean DEFAULT false,
    folder character varying(50) DEFAULT 'inbox'::character varying,
    thread_id character varying(255),
    message_id character varying(255),
    in_reply_to character varying(255),
    attachments jsonb DEFAULT '[]'::jsonb,
    received_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    labels text[],
    has_attachments boolean DEFAULT false
);

ALTER TABLE ONLY emails
    ADD CONSTRAINT emails_mailbox_id_fkey FOREIGN KEY (mailbox_id) REFERENCES connected_mailboxes(id) ON DELETE CASCADE;

ALTER TABLE ONLY emails
    ADD CONSTRAINT emails_message_id_key UNIQUE (message_id);

CREATE INDEX idx_emails_mailbox_id ON emails USING btree (mailbox_id);





--
-- Name: employee_documents; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS employee_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    org_id uuid NOT NULL,
    document_type character varying(100) NOT NULL,
    document_name character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size integer,
    uploaded_by uuid NOT NULL,
    uploaded_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    updated_by uuid,
    is_verified boolean DEFAULT false,
    verified_by uuid,
    verified_at timestamp with time zone
);



--
-- Name: TABLE employee_documents; Type: COMMENT; Schema: public
--

COMMENT ON TABLE employee_documents IS 'Stores employee document uploads';


--
-- Name: employee_leave_balances; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS employee_leave_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    leave_type_id uuid NOT NULL,
    org_id uuid NOT NULL,
    year integer NOT NULL,
    total_allocated numeric(5,2) DEFAULT 0 NOT NULL,
    used numeric(5,2) DEFAULT 0 NOT NULL,
    pending numeric(5,2) DEFAULT 0 NOT NULL,
    available numeric(5,2) GENERATED ALWAYS AS (((total_allocated - used) - pending)) STORED,
    carried_forward numeric(5,2) DEFAULT 0,
    expires_on date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    remaining numeric(5,2) DEFAULT 0
);



--
-- Name: TABLE employee_leave_balances; Type: COMMENT; Schema: public
--

COMMENT ON TABLE employee_leave_balances IS 'Employee leave balance tracking per year';


--
-- Name: employee_product_assignments; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS employee_product_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    status character varying(50) DEFAULT 'assigned'::character varying,
    assigned_date date DEFAULT CURRENT_DATE,
    return_date date,
    condition_at_assignment character varying(100),
    condition_at_return character varying(100),
    notes text,
    assigned_by uuid,
    returned_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: employee_salaries; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS employee_salaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    basic_salary numeric(10,2) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: employees; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS employees (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    user_id uuid,
    employee_code character varying(50),
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50),
    date_of_birth date,
    gender character varying(20),
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(100),
    postal_code character varying(20),
    department character varying(100),
    "position" character varying(100),
    employment_type character varying(50) DEFAULT 'full-time'::character varying,
    join_date date,
    termination_date date,
    salary numeric(15,2),
    currency character varying(10) DEFAULT 'USD'::character varying,
    bank_account character varying(100),
    tax_id character varying(100),
    emergency_contact_name character varying(255),
    emergency_contact_phone character varying(50),
    status character varying(50) DEFAULT 'active'::character varying,
    profile_picture_url character varying(500),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    manager_id uuid,
    employee_id character varying(50),
    org_id uuid,
    name character varying(255),
    job_title character varying(255),
    hire_date date,
    created_by uuid,
    reporting_manager_id uuid,
    work_email character varying(255),
    probation_end_date date,
    contract_type character varying(50),
    blood_group character varying(10),
    marital_status character varying(20),
    nationality character varying(100),
    updated_by uuid,
    profile_picture character varying(500),
    emergency_contact_relationship character varying(100),
    secondary_phone character varying(50),
    official_email character varying(255),
    personal_email character varying(255),
    cnic character varying(50),
    cnic_picture text,
    religion character varying(50),
    probation_status character varying(50),
    commission_rate numeric(5,2),
    base_salary numeric(12,2),
    permanent_address text,
    current_address text,
    bank_name character varying(255),
    bank_account_number character varying(100),
    bank_account_title character varying(255),
    education_level character varying(100),
    university character varying(255),
    emergency_contact_relation character varying(100)
);



--
-- Name: entity_drive_files; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS entity_drive_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    drive_connection_id uuid,
    file_id character varying(255) NOT NULL,
    file_name character varying(255) NOT NULL,
    mime_type character varying(100),
    file_size bigint,
    web_view_link text,
    thumbnail_link text,
    folder_path text,
    linked_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: hrms_notifications; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS hrms_notifications (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    employee_id uuid,
    type character varying(50) DEFAULT 'info'::character varying NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notification_type character varying(100),
    user_id uuid,
    created_by uuid,
    priority character varying(50) DEFAULT 'normal'::character varying,
    action_url text,
    read_at timestamp without time zone,
    data jsonb DEFAULT '{}'::jsonb
);



--
-- Name: invoice_items; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS invoice_items (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    invoice_id uuid,
    product_id uuid,
    description text NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    tax_rate numeric(5,2) DEFAULT 0,
    discount_percent numeric(5,2) DEFAULT 0,
    total_price numeric(15,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: invoices; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS invoices (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    invoice_number character varying(100) NOT NULL,
    customer_id uuid,
    contact_id uuid,
    invoice_date date NOT NULL,
    due_date date,
    status character varying(50) DEFAULT 'draft'::character varying,
    subtotal numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0,
    paid_amount numeric(15,2) DEFAULT 0,
    balance_due numeric(15,2) DEFAULT 0,
    currency character varying(10) DEFAULT 'USD'::character varying,
    notes text,
    terms text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    payment_terms character varying(100),
    payment_method character varying(50),
    shipping_address text,
    shipping_cost numeric(15,2) DEFAULT 0,
    payment_status character varying(50),
    payment_date date
);



--
-- Name: lead_external_sources; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS lead_external_sources (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    source_type character varying(50),
    api_key text,
    webhook_url text,
    config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    workspace_id uuid
);



--
-- Name: lead_imports; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS lead_imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    workspace_id uuid,
    imported_by uuid NOT NULL,
    source_type character varying(50),
    file_name character varying(255),
    file_path text,
    field_mapping jsonb,
    status character varying(50) DEFAULT 'processing'::character varying,
    total_rows integer DEFAULT 0,
    successful_imports integer DEFAULT 0,
    failed_imports integer DEFAULT 0,
    duplicate_skipped integer DEFAULT 0,
    error_log jsonb,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: lead_workspace_access; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS lead_workspace_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    granted_by uuid,
    access_level character varying(50) DEFAULT 'view'::character varying,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: lead_workspaces; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS lead_workspaces (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: leads; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS leads (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    first_name character varying(100),
    last_name character varying(100),
    email character varying(255),
    phone character varying(50),
    company character varying(255),
    job_title character varying(100),
    source character varying(100),
    status character varying(50) DEFAULT 'new'::character varying,
    score integer DEFAULT 0,
    notes text,
    assigned_to uuid,
    converted_to_deal boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    workspace_id uuid,
    deal_id uuid,
    campaign_id uuid,
    utm_source character varying(100),
    utm_medium character varying(100),
    utm_campaign character varying(100),
    contact_id uuid,
    org_id uuid,
    converted_to_deal_id uuid,
    converted_at timestamp without time zone,
    external_source_id character varying(100),
    pipeline character varying(100),
    owner_id uuid,
    lead_source character varying(100),
    user_id uuid,
    company_id uuid,
    external_id character varying(255),
    name character varying(255),
    company_name character varying(255),
    company_email character varying(255),
    company_phone character varying(50),
    designation character varying(255),
    website character varying(255),
    address text,
    company_size character varying(50),
    agent_name character varying(255),
    decision_maker character varying(255),
    service_interested character varying(255),
    interaction_notes text,
    first_message text,
    last_touch timestamp with time zone,
    source_info jsonb,
    phone_type character varying(50),
    email_type character varying(50),
    website_type character varying(50),
    customer_type character varying(50),
    last_contacted_date timestamp with time zone,
    next_follow_up_date timestamp with time zone,
    responsible_person character varying(255),
    priority character varying(50),
    tags text[],
    expected_close_date date,
    description text,
    title character varying(255),
    stage character varying(100) DEFAULT 'new'::character varying,
    value numeric DEFAULT 0,
    currency character varying(10) DEFAULT 'USD'::character varying,
    import_id uuid,
    created_by uuid,
    updated_by uuid,
    is_converted boolean DEFAULT false,
    custom_fields jsonb DEFAULT '{}'::jsonb
);



--
-- Name: leave_balances; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS leave_balances (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    employee_id uuid,
    leave_type_id uuid,
    year integer NOT NULL,
    total_days numeric(5,2) DEFAULT 0,
    used_days numeric(5,2) DEFAULT 0,
    remaining_days numeric(5,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: leave_request_comments; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS leave_request_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    leave_request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    comment text NOT NULL,
    action character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: TABLE leave_request_comments; Type: COMMENT; Schema: public
--

COMMENT ON TABLE leave_request_comments IS 'Comments and history for leave requests';


--
-- Name: leave_requests; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    leave_type_id uuid NOT NULL,
    org_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_requested numeric(5,2) NOT NULL,
    half_day boolean DEFAULT false,
    reason text NOT NULL,
    attachment_path text,
    status character varying(20) DEFAULT 'pending'::character varying,
    approver_id uuid,
    approved_at timestamp with time zone,
    rejection_reason text,
    emergency boolean DEFAULT false,
    contact_during_leave character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id uuid,
    approved_by uuid,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_by uuid,
    updated_by uuid,
    half_day_period character varying(20),
    CONSTRAINT leave_requests_check CHECK ((end_date >= start_date)),
    CONSTRAINT leave_requests_days_requested_check CHECK ((days_requested > (0)::numeric)),
    CONSTRAINT leave_requests_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('cancelled'::character varying)::text])))
);



--
-- Name: TABLE leave_requests; Type: COMMENT; Schema: public
--

COMMENT ON TABLE leave_requests IS 'Leave requests with approval workflow';


--
-- Name: leave_types; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS leave_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    description text,
    color character varying(20) DEFAULT '#3B82F6'::character varying,
    days_allowed integer DEFAULT 0 NOT NULL,
    max_consecutive_days integer,
    min_days_notice integer DEFAULT 0,
    is_paid boolean DEFAULT true,
    requires_approval boolean DEFAULT true,
    can_carry_forward boolean DEFAULT false,
    max_carry_forward_days integer DEFAULT 0,
    expires_after_months integer,
    applicable_to character varying(20) DEFAULT 'all'::character varying,
    min_service_months integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id uuid,
    days_per_year integer DEFAULT 0,
    org_id uuid,
    carry_forward boolean DEFAULT false,
    max_carry_forward integer DEFAULT 0,
    notice_days integer DEFAULT 0,
    created_by uuid,
    updated_by uuid
);



--
-- Name: TABLE leave_types; Type: COMMENT; Schema: public
--

COMMENT ON TABLE leave_types IS 'Leave type definitions with policies and rules';


--
-- Name: marketing_ab_test_results; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_ab_test_results (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    test_id uuid,
    variant_id uuid,
    contact_id uuid,
    opened boolean DEFAULT false,
    clicked boolean DEFAULT false,
    converted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: marketing_ab_test_variants; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_ab_test_variants (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    test_id uuid,
    variant_name character varying(100) NOT NULL,
    subject character varying(500),
    content text,
    design jsonb,
    sent_count integer DEFAULT 0,
    opened_count integer DEFAULT 0,
    clicked_count integer DEFAULT 0,
    conversion_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: marketing_ab_tests; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_ab_tests (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    test_type character varying(50) DEFAULT 'subject_line'::character varying,
    status character varying(50) DEFAULT 'draft'::character varying,
    winner_criteria character varying(50) DEFAULT 'open_rate'::character varying,
    sample_size_percent integer DEFAULT 20,
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    winner_variant_id uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: marketing_campaign_events; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_campaign_events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    contact_id uuid,
    event_type character varying(50) NOT NULL,
    event_data jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    email character varying(255),
    opened_at timestamp without time zone,
    clicked_at timestamp without time zone
);



--
-- Name: marketing_campaigns; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    type character varying(50) DEFAULT 'email'::character varying,
    subject character varying(500),
    content text,
    list_id uuid,
    status character varying(50) DEFAULT 'draft'::character varying,
    scheduled_at timestamp without time zone,
    sent_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    campaign_type character varying(50) DEFAULT 'email'::character varying,
    channel character varying(50) DEFAULT 'email'::character varying,
    from_name character varying(255),
    from_email character varying(255),
    reply_to character varying(255),
    design jsonb,
    stats jsonb DEFAULT '{"sent": 0, "opened": 0, "bounced": 0, "clicked": 0, "delivered": 0, "unsubscribed": 0}'::jsonb,
    org_id uuid,
    segment_id uuid,
    sent_count integer DEFAULT 0,
    opened_count integer DEFAULT 0,
    clicked_count integer DEFAULT 0,
    bounced_count integer DEFAULT 0,
    unsubscribed_count integer DEFAULT 0,
    template_id uuid
);



--
-- Name: marketing_form_submissions; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_form_submissions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    form_id uuid,
    contact_id uuid,
    data jsonb NOT NULL,
    ip_address character varying(45),
    user_agent text,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: marketing_forms; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_forms (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    list_id uuid,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    redirect_url character varying(500),
    thank_you_message text,
    submission_count integer DEFAULT 0,
    org_id uuid,
    success_message text,
    auto_add_to_list uuid
);



--
-- Name: marketing_list_members; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_list_members (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    list_id uuid,
    contact_id uuid,
    status character varying(50) DEFAULT 'subscribed'::character varying,
    subscribed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: marketing_lists; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_lists (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    type character varying(50) DEFAULT 'static'::character varying,
    member_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    segment_rules jsonb,
    org_id uuid
);



--
-- Name: marketing_scoring_history; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_scoring_history (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    contact_id uuid,
    rule_id uuid,
    score_change integer NOT NULL,
    reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: marketing_scoring_rules; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_scoring_rules (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    rule_type character varying(50) NOT NULL,
    conditions jsonb NOT NULL,
    score_value integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: marketing_segments; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_segments (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    rules jsonb NOT NULL,
    contact_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid
);



--
-- Name: marketing_sequence_enrollments; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_sequence_enrollments (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    sequence_id uuid,
    contact_id uuid,
    current_step integer DEFAULT 0,
    status character varying(50) DEFAULT 'active'::character varying,
    enrolled_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: marketing_sequence_steps; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_sequence_steps (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    sequence_id uuid,
    step_order integer NOT NULL,
    name character varying(255) NOT NULL,
    delay_days integer DEFAULT 0,
    delay_hours integer DEFAULT 0,
    email_subject character varying(500),
    email_content text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: marketing_sequences; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_sequences (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    trigger_type character varying(50) DEFAULT 'manual'::character varying,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    enrollment_count integer DEFAULT 0,
    org_id uuid,
    trigger_conditions jsonb DEFAULT '{}'::jsonb,
    steps jsonb DEFAULT '[]'::jsonb
);



--
-- Name: marketing_templates; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_templates (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    subject character varying(500),
    content text,
    design jsonb,
    thumbnail_url character varying(500),
    is_public boolean DEFAULT false,
    usage_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid
);



--
-- Name: marketing_webhook_logs; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_webhook_logs (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    webhook_id uuid,
    event_type character varying(50) NOT NULL,
    payload jsonb NOT NULL,
    response_status integer,
    response_body text,
    attempt_count integer DEFAULT 1,
    success boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: marketing_webhook_queue; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_webhook_queue (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    webhook_id uuid,
    event_type character varying(50) NOT NULL,
    payload jsonb NOT NULL,
    attempts integer DEFAULT 0,
    next_retry_at timestamp without time zone,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: marketing_webhooks; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS marketing_webhooks (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    url character varying(500) NOT NULL,
    events text[] NOT NULL,
    secret_key character varying(255),
    is_active boolean DEFAULT true,
    retry_count integer DEFAULT 3,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: notification_templates; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS notification_templates (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    subject character varying(500),
    body text,
    variables jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid
);

-- ============================================================
-- Rush-CRM: Unified Notifications System
-- Enhanced migration to handle potential legacy table conflicts
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    org_id SET NOT NULL,
    title SET NOT NULL,
    target_user_id SET NOT NULL,
    type SET NOT NULL,
    category SET NOT NULL,
    message SET NOT NULL,
    metadata SET NOT NULL,
    category VARCHAR(40) DEFAULT 'general';
    is_read SET NOT NULL,
    action_url VARCHAR(500),
    actor_user_id UUID,
    created_at SET NOT NULL,
    link character varying(500),
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create indices (safely handles existence)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (target_user_id, org_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_org
    ON notifications (target_user_id, org_id);

--
-- Name: organizations; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS organizations (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    domain character varying(255),
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: payroll; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS payroll (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    employee_id uuid,
    period_start date NOT NULL,
    period_end date NOT NULL,
    basic_salary numeric(15,2) NOT NULL,
    allowances jsonb DEFAULT '{}'::jsonb,
    deductions jsonb DEFAULT '{}'::jsonb,
    gross_salary numeric(15,2) NOT NULL,
    net_salary numeric(15,2) NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0,
    status character varying(50) DEFAULT 'draft'::character varying,
    paid_at timestamp without time zone,
    payment_method character varying(50),
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    payment_date date,
    bank_reference character varying(100),
    updated_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone
);


--
-- Name: permissions; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS permissions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    resource character varying(100) NOT NULL,
    action character varying(50) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: pipeline_stages; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    pipeline character varying(100) DEFAULT 'default'::character varying,
    stage_key character varying(100) NOT NULL,
    stage_label character varying(255) NOT NULL,
    sort_order integer DEFAULT 0,
    color character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: product_batches; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS product_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    product_id uuid NOT NULL,
    batch_number character varying(100) NOT NULL,
    expiration_date date,
    quantity integer DEFAULT 0,
    cost_per_unit numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    manufacturing_date date,
    expiry_date date,
    supplier_id uuid
);



--
-- Name: products; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS products (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    sku character varying(100),
    description text,
    category character varying(100),
    unit character varying(50) DEFAULT 'piece'::character varying,
    price numeric(15,2) DEFAULT 0,
    cost numeric(15,2) DEFAULT 0,
    tax_rate numeric(5,2) DEFAULT 0,
    barcode character varying(100),
    image_url character varying(500),
    is_active boolean DEFAULT true,
    min_stock_level integer DEFAULT 0,
    reorder_point integer,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    max_stock_level integer,
    valuation_method character varying(20) DEFAULT 'FIFO'::character varying,
    unit_price numeric(10,2) DEFAULT 0,
    cost_price numeric(10,2) DEFAULT 0,
    reorder_level integer DEFAULT 10,
    reorder_quantity integer DEFAULT 50,
    org_id uuid,
    initial_stock integer DEFAULT 0,
    supplier_id uuid,
    brand character varying(100),
    weight numeric(10,2),
    dimensions character varying(100),
    warranty_period integer,
    warranty_type character varying(50),
    tags text[],
    status character varying(50) DEFAULT 'active'::character varying
);



--
-- Name: profiles; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS profiles (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid,
    org_id uuid,
    full_name character varying(255),
    email character varying(255),
    avatar_url character varying(500),
    phone character varying(50),
    "position" character varying(100),
    department character varying(100),
    bio text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    job_title character varying(255),
    avatar character varying(500),
    location character varying(255),
    timezone character varying(100),
    language character varying(50)
);



--
-- Name: project_activity_logs; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS project_activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    description text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);



--
-- Name: project_attachments; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS project_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid,
    task_id uuid,
    entity_type character varying(50),
    entity_id uuid,
    file_name character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size bigint,
    file_type character varying(100),
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: project_comments; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS project_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid,
    task_id uuid,
    entity_type character varying(50),
    entity_id uuid,
    user_id uuid NOT NULL,
    comment text NOT NULL,
    attachments jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: project_documents; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS project_documents (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    project_id uuid,
    name character varying(255) NOT NULL,
    file_url character varying(500) NOT NULL,
    file_size integer,
    file_type character varying(100),
    uploaded_by uuid,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    created_by uuid,
    updated_by uuid,
    version integer DEFAULT 1,
    is_archived boolean DEFAULT false
);



--
-- Name: project_members; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS project_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying,
    permissions jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: project_milestones; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS project_milestones (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    project_id uuid,
    name character varying(255) NOT NULL,
    description text,
    due_date date NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    progress integer DEFAULT 0,
    budget numeric,
    actual_cost numeric,
    color character varying(50),
    is_completed boolean DEFAULT false,
    created_by uuid,
    updated_by uuid
);



--
-- Name: project_risks; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS project_risks (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    project_id uuid,
    title character varying(255) NOT NULL,
    description text,
    probability character varying(50) DEFAULT 'medium'::character varying,
    impact character varying(50) DEFAULT 'medium'::character varying,
    mitigation_plan text,
    status character varying(50) DEFAULT 'identified'::character varying,
    owner_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    severity character varying(50) DEFAULT 'medium'::character varying,
    category character varying(100),
    org_id uuid,
    created_by uuid,
    updated_by uuid,
    identified_date date,
    resolved_date date
);



--
-- Name: project_tasks; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS project_tasks (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    project_id uuid,
    title character varying(255) NOT NULL,
    description text,
    assigned_to uuid,
    status character varying(50) DEFAULT 'todo'::character varying,
    priority character varying(50) DEFAULT 'medium'::character varying,
    start_date date,
    due_date date,
    estimated_hours numeric(8,2),
    actual_hours numeric(8,2),
    progress integer DEFAULT 0,
    parent_task_id uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    milestone_id uuid,
    tags text[],
    watchers uuid[],
    dependencies uuid[],
    labels text[],
    updated_by uuid
);



--
-- Name: project_time_entries; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS project_time_entries (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    project_id uuid,
    task_id uuid,
    user_id uuid,
    description text,
    hours numeric(8,2) NOT NULL,
    date date NOT NULL,
    billable boolean DEFAULT true,
    hourly_rate numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_billable boolean DEFAULT true,
    total_amount numeric,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);



--
-- Name: projects; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS projects (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    client_id uuid,
    start_date date,
    end_date date,
    budget numeric(15,2),
    currency character varying(10) DEFAULT 'USD'::character varying,
    status character varying(50) DEFAULT 'planning'::character varying,
    priority character varying(50) DEFAULT 'medium'::character varying,
    progress integer DEFAULT 0,
    manager_id uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    owner_id uuid,
    color character varying(20),
    client_name character varying(255),
    budget_spent numeric(15,2) DEFAULT 0,
    tags text[],
    attachments jsonb,
    team_members uuid[],
    is_archived boolean DEFAULT false,
    archived_at timestamp with time zone,
    completed_at timestamp with time zone,
    estimated_hours numeric,
    actual_hours numeric,
    updated_by uuid
);



--
-- Name: public_holidays; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS public_holidays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    date date NOT NULL,
    is_optional boolean DEFAULT false,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: TABLE public_holidays; Type: COMMENT; Schema: public
--

COMMENT ON TABLE public_holidays IS 'Organization public holidays';


--
-- Name: purchase_order_items; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    purchase_order_id uuid,
    product_id uuid,
    quantity integer NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    tax_rate numeric(5,2) DEFAULT 0,
    total_price numeric(15,2),
    received_quantity integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: purchase_orders; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS purchase_orders (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    po_number character varying(100) NOT NULL,
    vendor_id uuid,
    warehouse_id uuid,
    order_date date NOT NULL,
    expected_delivery_date date,
    status character varying(50) DEFAULT 'draft'::character varying,
    subtotal numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0,
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    expected_delivery date,
    order_status character varying(50) DEFAULT 'pending'::character varying,
    delivery_address text,
    shipping_cost numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0
);



--
-- Name: roles; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS roles (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(100) NOT NULL,
    description text,
    permissions jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid
);



--
-- Name: salary_components; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS salary_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    is_percentage boolean DEFAULT false,
    amount numeric(10,2) DEFAULT 0,
    percentage numeric(5,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: salary_slip_items; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS salary_slip_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salary_slip_id uuid NOT NULL,
    component_name character varying(255) NOT NULL,
    component_type character varying(50) NOT NULL,
    amount numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: salary_slips; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS salary_slips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    basic_salary numeric(10,2) NOT NULL,
    total_earnings numeric(10,2) DEFAULT 0,
    total_deductions numeric(10,2) DEFAULT 0,
    net_salary numeric(10,2) NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying,
    generated_by uuid,
    generated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    paid_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    payment_date date,
    notes text,
    created_by uuid,
    sent_at timestamp with time zone
);



--
-- Name: signing_parties; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS signing_parties (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    role character varying(100),
    company character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: stock; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS stock (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    product_id uuid,
    warehouse_id uuid,
    quantity integer DEFAULT 0,
    reserved_quantity integer DEFAULT 0,
    available_quantity integer DEFAULT 0,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    min_stock_alert boolean DEFAULT false,
    reorder_level integer
);



--
-- Name: stock_adjustments; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS stock_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    product_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    adjustment_type character varying(50) NOT NULL,
    quantity_before integer NOT NULL,
    quantity_adjusted integer NOT NULL,
    quantity_after integer NOT NULL,
    reason text,
    notes text,
    adjusted_by uuid,
    adjustment_date date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: stock_movements; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS stock_movements (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    product_id uuid,
    warehouse_id uuid,
    movement_type character varying(50),
    quantity integer NOT NULL,
    reference_type character varying(50),
    reference_id uuid,
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    type character varying(50),
    reason text,
    reference character varying(255),
    batch_number character varying(100),
    expiry_date date
);



--
-- Name: tasks; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid,
    title character varying(255) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'pending'::character varying,
    priority character varying(50) DEFAULT 'medium'::character varying,
    assigned_to uuid,
    due_date date,
    sort_order integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    parent_task_id uuid,
    milestone_id uuid,
    start_date date,
    end_date date,
    estimated_hours numeric,
    actual_hours numeric,
    progress integer DEFAULT 0,
    tags text[],
    attachments jsonb,
    dependencies uuid[],
    watchers uuid[],
    completed_at timestamp with time zone,
    is_recurring boolean DEFAULT false,
    recurrence_pattern character varying(100),
    labels text[],
    updated_by uuid
);



--
-- Name: unibox_emails; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS unibox_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    external_id character varying(255),
    sender_email character varying(255) NOT NULL,
    sender_name character varying(255),
    recipient_email character varying(255),
    recipient_name character varying(255),
    subject text,
    body_text text,
    body_html text,
    status character varying(50) DEFAULT 'New'::character varying,
    priority character varying(50) DEFAULT 'Normal'::character varying,
    received_at timestamp with time zone,
    is_read boolean DEFAULT false,
    is_starred boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    assigned_to uuid,
    converted_to_lead_id uuid,
    tags text[],
    attachments jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    body text
);



--
-- Name: user_roles; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    id uuid DEFAULT uuid_generate_v4(),
    role character varying(50) DEFAULT 'user'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid
);



--
-- Name: users; Type: TABLE; Schema: public
--
CREATE TYPE user_role AS ENUM (
    'super_admin',
    'admin',
    'manager',
    'team_lead',
    'employee'
);

CREATE TABLE IF NOT EXISTS users (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid REFERENCES organizations(id),
    org_id uuid REFERENCES organizations(id),
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    phone character varying(50),
    role user_role DEFAULT 'employee'::user_role,
    department character varying(100),
    bio text,
    avatar_url character varying(500),
    password_change_required BOOLEAN DEFAULT FALSE,
    module_permissions JSONB DEFAULT '{}'::jsonb,
    invite_token TEXT UNIQUE,
    invite_expires_at TIMESTAMP WITH TIME ZONE,
    is_active boolean DEFAULT true,
    last_login timestamp without time zone,
    last_seen_at timestamp with time zone,
    "position" character varying(100),
    timezone character varying(100),
    language character varying(10) DEFAULT 'en'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_organization ON users (organization_id);
CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON users (last_seen_at);

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_email ON invites (email);
CREATE INDEX IF NOT EXISTS idx_invites_organization ON invites (organization_id);


--
-- Name: vendors; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS vendors (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    contact_person character varying(255),
    email character varying(255),
    phone character varying(50),
    address text,
    city character varying(100),
    country character varying(100),
    payment_terms character varying(100),
    tax_id character varying(100),
    status character varying(50) DEFAULT 'active'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    business_type character varying(100),
    rating numeric(2,1) DEFAULT 4.0,
    created_by uuid,
    org_id uuid,
    website character varying(255),
    credit_limit numeric(15,2),
    credit_days integer,
    bank_name character varying(255),
    bank_account character varying(100)
);



--
-- Name: warehouses; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS warehouses (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    code character varying(50),
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(100),
    postal_code character varying(20),
    manager_id uuid,
    capacity integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    manager_name character varying(255),
    phone character varying(50),
    email character varying(255),
    type character varying(50),
    operating_hours character varying(100),
    status character varying(50) DEFAULT 'active'::character varying,
    created_by uuid
);



--
-- Name: workflow_actions; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workflow_actions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    workflow_id uuid,
    action_order integer NOT NULL,
    action_type character varying(100) NOT NULL,
    action_config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    condition_config jsonb,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    sort_order integer DEFAULT 0
);



--
-- Name: workflow_execution_steps; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workflow_execution_steps (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    execution_id uuid,
    action_id uuid,
    status character varying(50) DEFAULT 'running'::character varying,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: workflow_executions; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workflow_executions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    workflow_id uuid,
    status character varying(50) DEFAULT 'running'::character varying,
    trigger_data jsonb,
    result jsonb,
    error_message text,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    entity_id uuid,
    triggered_by uuid,
    entity_type character varying(50)
);



--
-- Name: workflows; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workflows (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    trigger_type character varying(100) NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    execution_count integer DEFAULT 0,
    last_executed_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    trigger_event character varying(100),
    conditions jsonb DEFAULT '{}'::jsonb
);



--
-- Name: workgroup_activities; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workgroup_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workgroup_id uuid NOT NULL,
    user_id uuid,
    activity_type character varying(100) NOT NULL,
    activity_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: TABLE workgroup_activities; Type: COMMENT; Schema: public
--

COMMENT ON TABLE workgroup_activities IS 'Activity log for workgroups for audit and notifications';


--
-- Name: workgroup_channels; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workgroup_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workgroup_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    type character varying(50) DEFAULT 'standard'::character varying,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_general boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    member_count integer DEFAULT 0,
    message_count integer DEFAULT 0,
    CONSTRAINT workgroup_channels_type_check CHECK (((type)::text = ANY (ARRAY[('standard'::character varying)::text, ('private'::character varying)::text, ('shared'::character varying)::text])))
);



--
-- Name: TABLE workgroup_channels; Type: COMMENT; Schema: public
--

COMMENT ON TABLE workgroup_channels IS 'Channels within workgroups for organized discussions';


--
-- Name: workgroup_files; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workgroup_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workgroup_id uuid NOT NULL,
    channel_id uuid,
    post_id uuid,
    name character varying(255) NOT NULL,
    original_name character varying(255) NOT NULL,
    file_type character varying(100),
    file_size bigint,
    mime_type character varying(255),
    file_path text NOT NULL,
    file_url text,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    uploaded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: TABLE workgroup_files; Type: COMMENT; Schema: public
--

COMMENT ON TABLE workgroup_files IS 'Files shared within workgroups and channels';


--
-- Name: workgroup_meeting_participants; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workgroup_meeting_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    meeting_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) DEFAULT 'attendee'::character varying,
    joined_at timestamp with time zone,
    left_at timestamp with time zone,
    is_muted boolean DEFAULT false,
    is_video_on boolean DEFAULT true,
    is_screen_sharing boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT workgroup_meeting_participants_role_check CHECK (((role)::text = ANY (ARRAY[('organizer'::character varying)::text, ('presenter'::character varying)::text, ('attendee'::character varying)::text])))
);



--
-- Name: workgroup_meetings; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workgroup_meetings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workgroup_id uuid NOT NULL,
    channel_id uuid,
    title character varying(255) NOT NULL,
    description text,
    meeting_type character varying(50) DEFAULT 'video'::character varying,
    status character varying(50) DEFAULT 'scheduled'::character varying,
    scheduled_start timestamp with time zone,
    scheduled_end timestamp with time zone,
    actual_start timestamp with time zone,
    actual_end timestamp with time zone,
    is_recurring boolean DEFAULT false,
    recurrence_pattern jsonb,
    max_participants integer DEFAULT 100,
    allow_recording boolean DEFAULT true,
    require_lobby boolean DEFAULT false,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT workgroup_meetings_meeting_type_check CHECK (((meeting_type)::text = ANY (ARRAY[('video'::character varying)::text, ('audio'::character varying)::text, ('screen_share'::character varying)::text]))),
    CONSTRAINT workgroup_meetings_status_check CHECK (((status)::text = ANY (ARRAY[('scheduled'::character varying)::text, ('active'::character varying)::text, ('ended'::character varying)::text, ('cancelled'::character varying)::text])))
);



--
-- Name: TABLE workgroup_meetings; Type: COMMENT; Schema: public
--

COMMENT ON TABLE workgroup_meetings IS 'Scheduled and active meetings within workgroups';


--
-- Name: workgroup_members; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workgroup_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workgroup_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying,
    joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    invited_by uuid,
    is_favorite boolean DEFAULT false,
    notification_settings jsonb DEFAULT '{"meetings": true, "mentions": true, "messages": true}'::jsonb,
    last_read_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT workgroup_members_role_check CHECK (((role)::text = ANY (ARRAY[('owner'::character varying)::text, ('admin'::character varying)::text, ('member'::character varying)::text, ('guest'::character varying)::text])))
);



--
-- Name: TABLE workgroup_members; Type: COMMENT; Schema: public
--

COMMENT ON TABLE workgroup_members IS 'Members of workgroups with roles and permissions';


--
-- Name: workgroup_notifications; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workgroup_notifications (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    workgroup_id uuid,
    user_id uuid,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: workgroup_posts; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workgroup_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workgroup_id uuid NOT NULL,
    channel_id uuid,
    user_id uuid NOT NULL,
    parent_id uuid,
    content text NOT NULL,
    content_type character varying(50) DEFAULT 'text'::character varying,
    is_pinned boolean DEFAULT false,
    is_edited boolean DEFAULT false,
    is_deleted boolean DEFAULT false,
    edited_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_for_users uuid[] DEFAULT '{}'::uuid[],
    reactions jsonb DEFAULT '{}'::jsonb,
    mention_users uuid[] DEFAULT '{}'::uuid[],
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_seen_at timestamp with time zone,
    CONSTRAINT workgroup_posts_content_type_check CHECK (((content_type)::text = ANY (ARRAY[('text'::character varying)::text, ('file'::character varying)::text, ('image'::character varying)::text, ('link'::character varying)::text, ('code'::character varying)::text])))
);



--
-- Name: TABLE workgroup_posts; Type: COMMENT; Schema: public
--

COMMENT ON TABLE workgroup_posts IS 'Messages/posts within workgroups and channels';


--
-- Name: workgroup_post_reads; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workgroup_post_reads (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    read_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: workgroups; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workgroups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    avatar_color character varying(50) DEFAULT 'bg-blue-500'::character varying,
    type character varying(50) DEFAULT 'team'::character varying,
    is_private boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    allow_guest_access boolean DEFAULT false,
    allow_member_add_remove boolean DEFAULT true,
    allow_member_create_channels boolean DEFAULT true,
    notification_settings jsonb DEFAULT '{"meetings": true, "mentions": true, "messages": true}'::jsonb,
    member_count integer DEFAULT 0,
    message_count integer DEFAULT 0,
    last_activity_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    settings jsonb DEFAULT '{}'::jsonb,
    cover_image character varying(500),
    CONSTRAINT workgroups_type_check CHECK (((type)::text = ANY (ARRAY[('team'::character varying)::text, ('project'::character varying)::text, ('private'::character varying)::text, ('department'::character varying)::text])))
);



--
-- Name: TABLE workgroups; Type: COMMENT; Schema: public
--

COMMENT ON TABLE workgroups IS 'Microsoft Teams-style workgroups/teams for collaboration';


--
-- Name: workgroup_stats; Type: VIEW; Schema: public
--

CREATE VIEW workgroup_stats AS
 SELECT w.id,
    w.name,
    w.type,
    w.is_private,
    w.member_count,
    w.message_count,
    w.last_activity_at,
    count(DISTINCT wm.user_id) AS actual_member_count,
    count(DISTINCT wp.id) AS actual_message_count,
    max(wp.created_at) AS last_message_at
   FROM ((workgroups w
     LEFT JOIN workgroup_members wm ON ((w.id = wm.workgroup_id)))
     LEFT JOIN workgroup_posts wp ON ((w.id = wp.workgroup_id)))
  GROUP BY w.id, w.name, w.type, w.is_private, w.member_count, w.message_count, w.last_activity_at;



--
-- Name: workgroup_wiki; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workgroup_wiki (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    workgroup_id uuid,
    title character varying(255) NOT NULL,
    content text,
    parent_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: workgroup_wiki_pages; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS workgroup_wiki_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workgroup_id uuid NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    content text,
    slug character varying(255) NOT NULL,
    is_published boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    created_by uuid NOT NULL,
    last_modified_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);



--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_employee_id_date_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY attendance
    ADD CONSTRAINT attendance_employee_id_date_key UNIQUE (employee_id, date);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: calendar_event_attendees calendar_event_attendees_event_id_user_id_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_event_id_user_id_key UNIQUE (event_id, user_id);


--
-- Name: calendar_event_attendees calendar_event_attendees_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: call_logs call_logs_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY call_logs
    ADD CONSTRAINT call_logs_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: connected_drives connected_drives_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY connected_drives
    ADD CONSTRAINT connected_drives_pkey PRIMARY KEY (id);


--
-- Name: connected_mailboxes connected_mailboxes_org_id_user_id_email_address_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY connected_mailboxes
    ADD CONSTRAINT connected_mailboxes_org_id_user_id_email_address_key UNIQUE (org_id, user_id, email_address);


--
-- Name: connected_mailboxes connected_mailboxes_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY connected_mailboxes
    ADD CONSTRAINT connected_mailboxes_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: crm_activities crm_activities_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY crm_activities
    ADD CONSTRAINT crm_activities_pkey PRIMARY KEY (id);


--
-- Name: crm_comments crm_comments_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY crm_comments
    ADD CONSTRAINT crm_comments_pkey PRIMARY KEY (id);


--
-- Name: crm_documents crm_documents_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY crm_documents
    ADD CONSTRAINT crm_documents_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: deal_contacts deal_contacts_org_id_deal_id_contact_id_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deal_contacts
    ADD CONSTRAINT deal_contacts_org_id_deal_id_contact_id_key UNIQUE (org_id, deal_id, contact_id);


--
-- Name: deal_contacts deal_contacts_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deal_contacts
    ADD CONSTRAINT deal_contacts_pkey PRIMARY KEY (id);


--
-- Name: deal_signing_parties deal_signing_parties_org_id_deal_id_contact_id_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deal_signing_parties
    ADD CONSTRAINT deal_signing_parties_org_id_deal_id_contact_id_key UNIQUE (org_id, deal_id, contact_id);


--
-- Name: deal_signing_parties deal_signing_parties_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deal_signing_parties
    ADD CONSTRAINT deal_signing_parties_pkey PRIMARY KEY (id);


--
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- Name: drive_activities drive_activities_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_activities
    ADD CONSTRAINT drive_activities_pkey PRIMARY KEY (id);


--
-- Name: drive_file_versions drive_file_versions_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_file_versions
    ADD CONSTRAINT drive_file_versions_pkey PRIMARY KEY (id);


--
-- Name: drive_files drive_files_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_files
    ADD CONSTRAINT drive_files_pkey PRIMARY KEY (id);


--
-- Name: drive_folders drive_folders_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_folders
    ADD CONSTRAINT drive_folders_pkey PRIMARY KEY (id);


--
-- Name: drive_permissions drive_permissions_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_permissions
    ADD CONSTRAINT drive_permissions_pkey PRIMARY KEY (id);


--
-- Name: emails emails_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY emails
    ADD CONSTRAINT emails_pkey PRIMARY KEY (id);


--
-- Name: employee_documents employee_documents_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employee_documents
    ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_leave_type_id_year_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_leave_type_id_year_key UNIQUE (employee_id, leave_type_id, year);


--
-- Name: employee_leave_balances employee_leave_balances_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_pkey PRIMARY KEY (id);


--
-- Name: employee_product_assignments employee_product_assignments_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employee_product_assignments
    ADD CONSTRAINT employee_product_assignments_pkey PRIMARY KEY (id);


--
-- Name: employee_salaries employee_salaries_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employee_salaries
    ADD CONSTRAINT employee_salaries_pkey PRIMARY KEY (id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_employee_code_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_employee_code_key UNIQUE (employee_code);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: entity_drive_files entity_drive_files_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY entity_drive_files
    ADD CONSTRAINT entity_drive_files_pkey PRIMARY KEY (id);


--
-- Name: hrms_notifications hrms_notifications_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY hrms_notifications
    ADD CONSTRAINT hrms_notifications_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: lead_external_sources lead_external_sources_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY lead_external_sources
    ADD CONSTRAINT lead_external_sources_pkey PRIMARY KEY (id);


--
-- Name: lead_imports lead_imports_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY lead_imports
    ADD CONSTRAINT lead_imports_pkey PRIMARY KEY (id);


--
-- Name: lead_workspace_access lead_workspace_access_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY lead_workspace_access
    ADD CONSTRAINT lead_workspace_access_pkey PRIMARY KEY (id);


--
-- Name: lead_workspaces lead_workspaces_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY lead_workspaces
    ADD CONSTRAINT lead_workspaces_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: leave_balances leave_balances_employee_id_leave_type_id_year_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_balances
    ADD CONSTRAINT leave_balances_employee_id_leave_type_id_year_key UNIQUE (employee_id, leave_type_id, year);


--
-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);


--
-- Name: leave_request_comments leave_request_comments_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_request_comments
    ADD CONSTRAINT leave_request_comments_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- Name: marketing_ab_test_results marketing_ab_test_results_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_ab_test_results
    ADD CONSTRAINT marketing_ab_test_results_pkey PRIMARY KEY (id);


--
-- Name: marketing_ab_test_variants marketing_ab_test_variants_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_ab_test_variants
    ADD CONSTRAINT marketing_ab_test_variants_pkey PRIMARY KEY (id);


--
-- Name: marketing_ab_tests marketing_ab_tests_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_ab_tests
    ADD CONSTRAINT marketing_ab_tests_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaign_events marketing_campaign_events_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_campaign_events
    ADD CONSTRAINT marketing_campaign_events_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaigns marketing_campaigns_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_pkey PRIMARY KEY (id);


--
-- Name: marketing_form_submissions marketing_form_submissions_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_form_submissions
    ADD CONSTRAINT marketing_form_submissions_pkey PRIMARY KEY (id);


--
-- Name: marketing_forms marketing_forms_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_forms
    ADD CONSTRAINT marketing_forms_pkey PRIMARY KEY (id);


--
-- Name: marketing_list_members marketing_list_members_list_id_contact_id_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_list_members
    ADD CONSTRAINT marketing_list_members_list_id_contact_id_key UNIQUE (list_id, contact_id);


--
-- Name: marketing_list_members marketing_list_members_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_list_members
    ADD CONSTRAINT marketing_list_members_pkey PRIMARY KEY (id);


--
-- Name: marketing_lists marketing_lists_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_lists
    ADD CONSTRAINT marketing_lists_pkey PRIMARY KEY (id);


--
-- Name: marketing_scoring_history marketing_scoring_history_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_scoring_history
    ADD CONSTRAINT marketing_scoring_history_pkey PRIMARY KEY (id);


--
-- Name: marketing_scoring_rules marketing_scoring_rules_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_scoring_rules
    ADD CONSTRAINT marketing_scoring_rules_pkey PRIMARY KEY (id);


--
-- Name: marketing_segments marketing_segments_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_segments
    ADD CONSTRAINT marketing_segments_pkey PRIMARY KEY (id);


--
-- Name: marketing_sequence_enrollments marketing_sequence_enrollments_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_sequence_enrollments
    ADD CONSTRAINT marketing_sequence_enrollments_pkey PRIMARY KEY (id);


--
-- Name: marketing_sequence_enrollments marketing_sequence_enrollments_sequence_id_contact_id_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_sequence_enrollments
    ADD CONSTRAINT marketing_sequence_enrollments_sequence_id_contact_id_key UNIQUE (sequence_id, contact_id);


--
-- Name: marketing_sequence_steps marketing_sequence_steps_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_sequence_steps
    ADD CONSTRAINT marketing_sequence_steps_pkey PRIMARY KEY (id);


--
-- Name: marketing_sequences marketing_sequences_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_sequences
    ADD CONSTRAINT marketing_sequences_pkey PRIMARY KEY (id);


--
-- Name: marketing_templates marketing_templates_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_templates
    ADD CONSTRAINT marketing_templates_pkey PRIMARY KEY (id);


--
-- Name: marketing_webhook_logs marketing_webhook_logs_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_webhook_logs
    ADD CONSTRAINT marketing_webhook_logs_pkey PRIMARY KEY (id);


--
-- Name: marketing_webhook_queue marketing_webhook_queue_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_webhook_queue
    ADD CONSTRAINT marketing_webhook_queue_pkey PRIMARY KEY (id);


--
-- Name: marketing_webhooks marketing_webhooks_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_webhooks
    ADD CONSTRAINT marketing_webhooks_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: payroll payroll_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY payroll
    ADD CONSTRAINT payroll_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: pipeline_stages pipeline_stages_org_id_pipeline_stage_key_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY pipeline_stages
    ADD CONSTRAINT pipeline_stages_org_id_pipeline_stage_key_key UNIQUE (org_id, pipeline, stage_key);


--
-- Name: pipeline_stages pipeline_stages_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY pipeline_stages
    ADD CONSTRAINT pipeline_stages_pkey PRIMARY KEY (id);


--
-- Name: product_batches product_batches_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY product_batches
    ADD CONSTRAINT product_batches_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_activity_logs project_activity_logs_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_activity_logs
    ADD CONSTRAINT project_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: project_attachments project_attachments_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_attachments
    ADD CONSTRAINT project_attachments_pkey PRIMARY KEY (id);


--
-- Name: project_comments project_comments_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_comments
    ADD CONSTRAINT project_comments_pkey PRIMARY KEY (id);


--
-- Name: project_documents project_documents_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_documents
    ADD CONSTRAINT project_documents_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_project_id_user_id_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_members
    ADD CONSTRAINT project_members_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: project_milestones project_milestones_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_milestones
    ADD CONSTRAINT project_milestones_pkey PRIMARY KEY (id);


--
-- Name: project_risks project_risks_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_risks
    ADD CONSTRAINT project_risks_pkey PRIMARY KEY (id);


--
-- Name: project_tasks project_tasks_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_tasks
    ADD CONSTRAINT project_tasks_pkey PRIMARY KEY (id);


--
-- Name: project_time_entries project_time_entries_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_time_entries
    ADD CONSTRAINT project_time_entries_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: public_holidays public_holidays_org_id_date_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public_holidays
    ADD CONSTRAINT public_holidays_org_id_date_key UNIQUE (org_id, date);


--
-- Name: public_holidays public_holidays_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public_holidays
    ADD CONSTRAINT public_holidays_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: salary_components salary_components_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY salary_components
    ADD CONSTRAINT salary_components_pkey PRIMARY KEY (id);


--
-- Name: salary_slip_items salary_slip_items_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY salary_slip_items
    ADD CONSTRAINT salary_slip_items_pkey PRIMARY KEY (id);


--
-- Name: salary_slips salary_slips_org_id_employee_id_month_year_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY salary_slips
    ADD CONSTRAINT salary_slips_org_id_employee_id_month_year_key UNIQUE (org_id, employee_id, month, year);


--
-- Name: salary_slips salary_slips_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY salary_slips
    ADD CONSTRAINT salary_slips_pkey PRIMARY KEY (id);


--
-- Name: signing_parties signing_parties_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY signing_parties
    ADD CONSTRAINT signing_parties_pkey PRIMARY KEY (id);


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock stock_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock
    ADD CONSTRAINT stock_pkey PRIMARY KEY (id);


--
-- Name: stock stock_product_id_warehouse_id_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock
    ADD CONSTRAINT stock_product_id_warehouse_id_key UNIQUE (product_id, warehouse_id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: unibox_emails unibox_emails_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY unibox_emails
    ADD CONSTRAINT unibox_emails_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_code_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY warehouses
    ADD CONSTRAINT warehouses_code_key UNIQUE (code);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: workflow_actions workflow_actions_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workflow_actions
    ADD CONSTRAINT workflow_actions_pkey PRIMARY KEY (id);


--
-- Name: workflow_execution_steps workflow_execution_steps_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workflow_execution_steps
    ADD CONSTRAINT workflow_execution_steps_pkey PRIMARY KEY (id);


--
-- Name: workflow_executions workflow_executions_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workflow_executions
    ADD CONSTRAINT workflow_executions_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: workgroup_activities workgroup_activities_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_activities
    ADD CONSTRAINT workgroup_activities_pkey PRIMARY KEY (id);


--
-- Name: workgroup_channels workgroup_channels_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_channels
    ADD CONSTRAINT workgroup_channels_pkey PRIMARY KEY (id);


--
-- Name: workgroup_channels workgroup_channels_workgroup_id_name_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_channels
    ADD CONSTRAINT workgroup_channels_workgroup_id_name_key UNIQUE (workgroup_id, name);


--
-- Name: workgroup_files workgroup_files_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_files
    ADD CONSTRAINT workgroup_files_pkey PRIMARY KEY (id);


--
-- Name: workgroup_meeting_participants workgroup_meeting_participants_meeting_id_user_id_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_meeting_participants
    ADD CONSTRAINT workgroup_meeting_participants_meeting_id_user_id_key UNIQUE (meeting_id, user_id);


--
-- Name: workgroup_meeting_participants workgroup_meeting_participants_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_meeting_participants
    ADD CONSTRAINT workgroup_meeting_participants_pkey PRIMARY KEY (id);


--
-- Name: workgroup_meetings workgroup_meetings_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_meetings
    ADD CONSTRAINT workgroup_meetings_pkey PRIMARY KEY (id);


--
-- Name: workgroup_members workgroup_members_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_members
    ADD CONSTRAINT workgroup_members_pkey PRIMARY KEY (id);


--
-- Name: workgroup_members workgroup_members_workgroup_id_user_id_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_members
    ADD CONSTRAINT workgroup_members_workgroup_id_user_id_key UNIQUE (workgroup_id, user_id);


--
-- Name: workgroup_notifications workgroup_notifications_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_notifications
    ADD CONSTRAINT workgroup_notifications_pkey PRIMARY KEY (id);


--
-- Name: workgroup_posts workgroup_posts_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_posts
    ADD CONSTRAINT workgroup_posts_pkey PRIMARY KEY (id);


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_pkey PRIMARY KEY (id);


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_workgroup_id_slug_key; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_workgroup_id_slug_key UNIQUE (workgroup_id, slug);


--
-- Name: workgroup_wiki workgroup_wiki_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_wiki
    ADD CONSTRAINT workgroup_wiki_pkey PRIMARY KEY (id);


--
-- Name: workgroups workgroups_pkey; Type: CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroups
    ADD CONSTRAINT workgroups_pkey PRIMARY KEY (id);


--
--
-- Name: idx_crm_comments_entity; Type: INDEX; Schema: public
--

CREATE INDEX idx_crm_comments_entity ON crm_comments USING btree (entity_type, entity_id);

--
-- Name: idx_crm_comments_org; Type: INDEX; Schema: public
--

CREATE INDEX idx_crm_comments_org ON crm_comments USING btree (org_id);

--
-- Name: idx_crm_documents_entity; Type: INDEX; Schema: public
--

CREATE INDEX idx_crm_documents_entity ON crm_documents USING btree (entity_type, entity_id);

--
-- Name: idx_crm_documents_org; Type: INDEX; Schema: public
--

CREATE INDEX idx_crm_documents_org ON crm_documents USING btree (org_id);

-- Name: idx_activities_contact; Type: INDEX; Schema: public
--

CREATE INDEX idx_activities_contact ON activities USING btree (contact_id);


--
-- Name: idx_activities_organization; Type: INDEX; Schema: public
--

CREATE INDEX idx_activities_organization ON activities USING btree (organization_id);


--
-- Name: idx_attendance_employee; Type: INDEX; Schema: public
--

CREATE INDEX idx_attendance_employee ON attendance USING btree (employee_id);


--
-- Name: idx_companies_organization; Type: INDEX; Schema: public
--

CREATE INDEX idx_companies_organization ON companies USING btree (organization_id);


--
-- Name: idx_connected_drives_org; Type: INDEX; Schema: public
--

CREATE INDEX idx_connected_drives_org ON connected_drives USING btree (org_id);


--
-- Name: idx_contacts_email; Type: INDEX; Schema: public
--

CREATE INDEX idx_contacts_email ON contacts USING btree (email);


--
-- Name: idx_contacts_organization; Type: INDEX; Schema: public
--

CREATE INDEX idx_contacts_organization ON contacts USING btree (organization_id);


--
-- Name: idx_customers_converted_deal; Type: INDEX; Schema: public
--

CREATE INDEX idx_customers_converted_deal ON customers USING btree (converted_from_deal_id);


--
-- Name: idx_customers_converted_lead; Type: INDEX; Schema: public
--

CREATE INDEX idx_customers_converted_lead ON customers USING btree (converted_from_lead_id);


--
-- Name: idx_deal_contacts_contact; Type: INDEX; Schema: public
--

CREATE INDEX idx_deal_contacts_contact ON deal_contacts USING btree (contact_id);


--
-- Name: idx_deal_contacts_deal; Type: INDEX; Schema: public
--

CREATE INDEX idx_deal_contacts_deal ON deal_contacts USING btree (deal_id);


--
-- Name: idx_deal_contacts_org; Type: INDEX; Schema: public
--

CREATE INDEX idx_deal_contacts_org ON deal_contacts USING btree (org_id);


--
-- Name: idx_deal_signing_parties_contact; Type: INDEX; Schema: public
--

CREATE INDEX idx_deal_signing_parties_contact ON deal_signing_parties USING btree (contact_id);


--
-- Name: idx_deal_signing_parties_deal; Type: INDEX; Schema: public
--

CREATE INDEX idx_deal_signing_parties_deal ON deal_signing_parties USING btree (deal_id);


--
-- Name: idx_deal_signing_parties_org; Type: INDEX; Schema: public
--

CREATE INDEX idx_deal_signing_parties_org ON deal_signing_parties USING btree (org_id);


--
-- Name: idx_deals_agent_name; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_agent_name ON deals USING btree (agent_name);


--
-- Name: idx_deals_company_name; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_company_name ON deals USING btree (company_name);


--
-- Name: idx_deals_contact; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_contact ON deals USING btree (contact_id);


--
-- Name: idx_deals_contact_name; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_contact_name ON deals USING btree (contact_name);


--
-- Name: idx_deals_converted_customer; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_converted_customer ON deals USING btree (converted_to_customer_id);


--
-- Name: idx_deals_converted_lead; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_converted_lead ON deals USING btree (converted_from_lead_id);


--
-- Name: idx_deals_email; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_email ON deals USING btree (email);


--
-- Name: idx_deals_external_source; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_external_source ON deals USING btree (external_source_id);


--
-- Name: idx_deals_organization; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_organization ON deals USING btree (organization_id);


--
-- Name: idx_deals_priority; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_priority ON deals USING btree (priority);


--
-- Name: idx_deals_service_interested; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_service_interested ON deals USING btree (service_interested);


--
-- Name: idx_deals_source; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_source ON deals USING btree (source);


--
-- Name: idx_deals_workspace_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_deals_workspace_id ON deals USING btree (workspace_id);


--
-- Name: idx_drive_permissions_drive; Type: INDEX; Schema: public
--

CREATE INDEX idx_drive_permissions_drive ON drive_permissions USING btree (drive_id);


--
-- Name: idx_employee_documents_employee; Type: INDEX; Schema: public
--

CREATE INDEX idx_employee_documents_employee ON employee_documents USING btree (employee_id);


--
-- Name: idx_employee_documents_org; Type: INDEX; Schema: public
--

CREATE INDEX idx_employee_documents_org ON employee_documents USING btree (org_id);


--
-- Name: idx_employee_documents_type; Type: INDEX; Schema: public
--

CREATE INDEX idx_employee_documents_type ON employee_documents USING btree (document_type);


--
-- Name: idx_employee_salaries_employee; Type: INDEX; Schema: public
--

CREATE INDEX idx_employee_salaries_employee ON employee_salaries USING btree (employee_id);


--
-- Name: idx_employees_organization; Type: INDEX; Schema: public
--

CREATE INDEX idx_employees_organization ON employees USING btree (organization_id);


--
-- Name: idx_entity_drive_files_entity; Type: INDEX; Schema: public
--

CREATE INDEX idx_entity_drive_files_entity ON entity_drive_files USING btree (entity_type, entity_id);


--
-- Name: idx_epa_employee_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_epa_employee_id ON employee_product_assignments USING btree (employee_id);


--
-- Name: idx_epa_org_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_epa_org_id ON employee_product_assignments USING btree (org_id);


--
-- Name: idx_epa_product_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_epa_product_id ON employee_product_assignments USING btree (product_id);


--
-- Name: idx_epa_status; Type: INDEX; Schema: public
--

CREATE INDEX idx_epa_status ON employee_product_assignments USING btree (status);


--
-- Name: idx_holidays_org_date; Type: INDEX; Schema: public
--

CREATE INDEX idx_holidays_org_date ON public_holidays USING btree (org_id, date);


--
-- Name: idx_lead_imports_imported_by; Type: INDEX; Schema: public
--

CREATE INDEX idx_lead_imports_imported_by ON lead_imports USING btree (imported_by);


--
-- Name: idx_lead_imports_org_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_lead_imports_org_id ON lead_imports USING btree (org_id);


--
-- Name: idx_lead_imports_status; Type: INDEX; Schema: public
--

CREATE INDEX idx_lead_imports_status ON lead_imports USING btree (status);


--
-- Name: idx_lead_imports_workspace_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_lead_imports_workspace_id ON lead_imports USING btree (workspace_id);


--
-- Name: idx_leads_assigned_to; Type: INDEX; Schema: public
--

CREATE INDEX idx_leads_assigned_to ON leads USING btree (assigned_to);


--
-- Name: idx_leads_converted_deal; Type: INDEX; Schema: public
--

CREATE INDEX idx_leads_converted_deal ON leads USING btree (converted_to_deal_id);


--
-- Name: idx_leads_converted_to_deal_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_leads_converted_to_deal_id ON leads USING btree (converted_to_deal_id);


--
-- Name: idx_leads_created_by; Type: INDEX; Schema: public
--

CREATE INDEX idx_leads_created_by ON leads USING btree (created_by);


--
-- Name: idx_leads_import_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_leads_import_id ON leads USING btree (import_id);


--
-- Name: idx_leads_organization; Type: INDEX; Schema: public
--

CREATE INDEX idx_leads_organization ON leads USING btree (organization_id);


--
-- Name: idx_leads_workspace; Type: INDEX; Schema: public
--

CREATE INDEX idx_leads_workspace ON leads USING btree (workspace_id);


--
-- Name: idx_leads_workspace_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_leads_workspace_id ON leads USING btree (workspace_id);


--
-- Name: idx_leave_balances_employee; Type: INDEX; Schema: public
--

CREATE INDEX idx_leave_balances_employee ON employee_leave_balances USING btree (employee_id);


--
-- Name: idx_leave_balances_org; Type: INDEX; Schema: public
--

CREATE INDEX idx_leave_balances_org ON employee_leave_balances USING btree (org_id);


--
-- Name: idx_leave_balances_year; Type: INDEX; Schema: public
--

CREATE INDEX idx_leave_balances_year ON employee_leave_balances USING btree (year);


--
-- Name: idx_leave_comments_request; Type: INDEX; Schema: public
--

CREATE INDEX idx_leave_comments_request ON leave_request_comments USING btree (leave_request_id);


--
-- Name: idx_leave_requests_dates; Type: INDEX; Schema: public
--

CREATE INDEX idx_leave_requests_dates ON leave_requests USING btree (start_date, end_date);


--
-- Name: idx_leave_requests_employee; Type: INDEX; Schema: public
--

CREATE INDEX idx_leave_requests_employee ON leave_requests USING btree (employee_id);


--
-- Name: idx_leave_requests_org; Type: INDEX; Schema: public
--

CREATE INDEX idx_leave_requests_org ON leave_requests USING btree (org_id);


--
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public
--

CREATE INDEX idx_leave_requests_status ON leave_requests USING btree (status);


--
-- Name: idx_marketing_campaigns_org; Type: INDEX; Schema: public
--

CREATE INDEX idx_marketing_campaigns_org ON marketing_campaigns USING btree (organization_id);


--
-- Name: idx_marketing_events_campaign; Type: INDEX; Schema: public
--

CREATE INDEX idx_marketing_events_campaign ON marketing_campaign_events USING btree (campaign_id);


--
-- Name: idx_marketing_events_contact; Type: INDEX; Schema: public
--

CREATE INDEX idx_marketing_events_contact ON marketing_campaign_events USING btree (contact_id);


--
-- Name: idx_marketing_lists_org; Type: INDEX; Schema: public
--

CREATE INDEX idx_marketing_lists_org ON marketing_lists USING btree (organization_id);


--
-- Name: idx_pipeline_stages_org; Type: INDEX; Schema: public
--

CREATE INDEX idx_pipeline_stages_org ON pipeline_stages USING btree (org_id);


--
-- Name: idx_product_batches_org; Type: INDEX; Schema: public
--

CREATE INDEX idx_product_batches_org ON product_batches USING btree (org_id);


--
-- Name: idx_product_batches_product; Type: INDEX; Schema: public
--

CREATE INDEX idx_product_batches_product ON product_batches USING btree (product_id);


--
-- Name: idx_products_barcode; Type: INDEX; Schema: public
--

CREATE INDEX idx_products_barcode ON products USING btree (barcode);


--
-- Name: idx_products_organization; Type: INDEX; Schema: public
--

CREATE INDEX idx_products_organization ON products USING btree (organization_id);


--
-- Name: idx_products_reorder_level; Type: INDEX; Schema: public
--

CREATE INDEX idx_products_reorder_level ON products USING btree (reorder_level);


--
-- Name: idx_project_activity_logs_project; Type: INDEX; Schema: public
--

CREATE INDEX idx_project_activity_logs_project ON project_activity_logs USING btree (project_id);


--
-- Name: idx_project_attachments_project; Type: INDEX; Schema: public
--

CREATE INDEX idx_project_attachments_project ON project_attachments USING btree (project_id);


--
-- Name: idx_project_comments_project; Type: INDEX; Schema: public
--

CREATE INDEX idx_project_comments_project ON project_comments USING btree (project_id);


--
-- Name: idx_project_comments_task; Type: INDEX; Schema: public
--

CREATE INDEX idx_project_comments_task ON project_comments USING btree (task_id);


--
-- Name: idx_project_members_project; Type: INDEX; Schema: public
--

CREATE INDEX idx_project_members_project ON project_members USING btree (project_id);


--
-- Name: idx_project_members_user; Type: INDEX; Schema: public
--

CREATE INDEX idx_project_members_user ON project_members USING btree (user_id);


--
-- Name: idx_project_tasks_parent; Type: INDEX; Schema: public
--

CREATE INDEX idx_project_tasks_parent ON project_tasks USING btree (parent_task_id);


--
-- Name: idx_projects_organization; Type: INDEX; Schema: public
--

CREATE INDEX idx_projects_organization ON projects USING btree (organization_id);


--
-- Name: idx_salary_components_org; Type: INDEX; Schema: public
--

CREATE INDEX idx_salary_components_org ON salary_components USING btree (org_id);


--
-- Name: idx_salary_slips_employee; Type: INDEX; Schema: public
--

CREATE INDEX idx_salary_slips_employee ON salary_slips USING btree (employee_id);


--
-- Name: idx_salary_slips_month_year; Type: INDEX; Schema: public
--

CREATE INDEX idx_salary_slips_month_year ON salary_slips USING btree (month, year);


--
-- Name: idx_stock_adjustments_org; Type: INDEX; Schema: public
--

CREATE INDEX idx_stock_adjustments_org ON stock_adjustments USING btree (org_id);


--
-- Name: idx_stock_adjustments_product; Type: INDEX; Schema: public
--

CREATE INDEX idx_stock_adjustments_product ON stock_adjustments USING btree (product_id);


--
-- Name: idx_stock_product; Type: INDEX; Schema: public
--

CREATE INDEX idx_stock_product ON stock USING btree (product_id);


--
-- Name: idx_tasks_milestone; Type: INDEX; Schema: public
--

CREATE INDEX idx_tasks_milestone ON tasks USING btree (milestone_id);


--
-- Name: idx_tasks_parent; Type: INDEX; Schema: public
--

CREATE INDEX idx_tasks_parent ON tasks USING btree (parent_task_id);


--
-- Name: idx_unibox_emails_org; Type: INDEX; Schema: public
--

CREATE INDEX idx_unibox_emails_org ON unibox_emails USING btree (org_id);


--
-- Name: idx_unibox_emails_sender; Type: INDEX; Schema: public
--

CREATE INDEX idx_unibox_emails_sender ON unibox_emails USING btree (sender_email);


--
-- Name: idx_unibox_emails_status; Type: INDEX; Schema: public
--

CREATE INDEX idx_unibox_emails_status ON unibox_emails USING btree (status);


--
-- Name: idx_users_email; Type: INDEX; Schema: public
--

CREATE INDEX idx_users_email ON users USING btree (email);


--
-- Name: idx_users_organization; Type: INDEX; Schema: public
--

CREATE INDEX idx_users_organization ON users USING btree (organization_id);


--
-- Name: idx_vendors_business_type; Type: INDEX; Schema: public
--

CREATE INDEX idx_vendors_business_type ON vendors USING btree (business_type);


--
-- Name: idx_workgroup_activities_workgroup_created; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_activities_workgroup_created ON workgroup_activities USING btree (workgroup_id, created_at DESC);


--
-- Name: idx_workgroup_channels_type; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_channels_type ON workgroup_channels USING btree (type);


--
-- Name: idx_workgroup_channels_workgroup_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_channels_workgroup_id ON workgroup_channels USING btree (workgroup_id);


--
-- Name: idx_workgroup_files_channel_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_files_channel_id ON workgroup_files USING btree (channel_id);


--
-- Name: idx_workgroup_files_created_at; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_files_created_at ON workgroup_files USING btree (created_at DESC);


--
-- Name: idx_workgroup_files_uploaded_by; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_files_uploaded_by ON workgroup_files USING btree (uploaded_by);


--
-- Name: idx_workgroup_files_workgroup_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_files_workgroup_id ON workgroup_files USING btree (workgroup_id);


--
-- Name: idx_workgroup_meetings_scheduled_start; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_meetings_scheduled_start ON workgroup_meetings USING btree (scheduled_start);


--
-- Name: idx_workgroup_meetings_status; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_meetings_status ON workgroup_meetings USING btree (status);


--
-- Name: idx_workgroup_meetings_workgroup_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_meetings_workgroup_id ON workgroup_meetings USING btree (workgroup_id);


--
-- Name: idx_workgroup_members_role; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_members_role ON workgroup_members USING btree (role);


--
-- Name: idx_workgroup_members_user_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_members_user_id ON workgroup_members USING btree (user_id);


--
-- Name: idx_workgroup_members_workgroup_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_members_workgroup_id ON workgroup_members USING btree (workgroup_id);


--
-- Name: idx_workgroup_notifications_created_at; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_notifications_created_at ON workgroup_notifications USING btree (created_at DESC);


--
-- Name: idx_workgroup_notifications_is_read; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_notifications_is_read ON workgroup_notifications USING btree (is_read);


--
-- Name: idx_workgroup_notifications_user_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_notifications_user_id ON workgroup_notifications USING btree (user_id);


--
-- Name: idx_workgroup_notifications_workgroup_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_notifications_workgroup_id ON workgroup_notifications USING btree (workgroup_id);


--
-- Name: idx_workgroup_posts_channel_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_posts_channel_id ON workgroup_posts USING btree (channel_id);


--
-- Name: idx_workgroup_posts_created_at; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_posts_created_at ON workgroup_posts USING btree (created_at DESC);


--
-- Name: idx_workgroup_posts_parent_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_posts_parent_id ON workgroup_posts USING btree (parent_id);


--
-- Name: idx_workgroup_posts_workgroup_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_posts_workgroup_id ON workgroup_posts USING btree (workgroup_id);


--
-- Name: idx_workgroup_wiki_pages_slug; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_wiki_pages_slug ON workgroup_wiki_pages USING btree (workgroup_id, slug);


--
-- Name: idx_workgroup_wiki_pages_workgroup_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroup_wiki_pages_workgroup_id ON workgroup_wiki_pages USING btree (workgroup_id);


--
-- Name: idx_workgroups_created_at; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroups_created_at ON workgroups USING btree (created_at DESC);


--
-- Name: idx_workgroups_org_id; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroups_org_id ON workgroups USING btree (org_id);


--
-- Name: idx_workgroups_type; Type: INDEX; Schema: public
--

CREATE INDEX idx_workgroups_type ON workgroups USING btree (type);


--
-- Name: workgroups trigger_add_creator_as_owner; Type: TRIGGER; Schema: public
--

CREATE TRIGGER trigger_add_creator_as_owner AFTER INSERT ON workgroups FOR EACH ROW EXECUTE FUNCTION add_creator_as_owner();


--
-- Name: workgroups trigger_create_default_channel; Type: TRIGGER; Schema: public
--

CREATE TRIGGER trigger_create_default_channel AFTER INSERT ON workgroups FOR EACH ROW EXECUTE FUNCTION create_default_channel();


--
-- Name: stock trigger_log_stock_movement; Type: TRIGGER; Schema: public
--

CREATE TRIGGER trigger_log_stock_movement AFTER UPDATE ON stock FOR EACH ROW EXECUTE FUNCTION log_stock_movement();


--
-- Name: leave_balances trigger_update_leave_balance; Type: TRIGGER; Schema: public
--

CREATE TRIGGER trigger_update_leave_balance BEFORE INSERT OR UPDATE ON leave_balances FOR EACH ROW EXECUTE FUNCTION update_leave_remaining_days();


--
-- Name: stock trigger_update_stock_available; Type: TRIGGER; Schema: public
--

CREATE TRIGGER trigger_update_stock_available BEFORE INSERT OR UPDATE ON stock FOR EACH ROW EXECUTE FUNCTION update_stock_available_quantity();


--
-- Name: workgroup_members trigger_update_workgroup_member_count; Type: TRIGGER; Schema: public
--

CREATE TRIGGER trigger_update_workgroup_member_count AFTER INSERT OR DELETE ON workgroup_members FOR EACH ROW EXECUTE FUNCTION update_workgroup_member_count();


--
-- Name: workgroup_posts trigger_update_workgroup_message_count; Type: TRIGGER; Schema: public
--

CREATE TRIGGER trigger_update_workgroup_message_count AFTER INSERT OR DELETE ON workgroup_posts FOR EACH ROW EXECUTE FUNCTION update_workgroup_message_count();


--
-- Name: activities update_activities_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: attendance update_attendance_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: calendar_events update_calendar_events_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: companies update_companies_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: contacts update_contacts_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: deals update_deals_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: drive_files update_drive_files_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_drive_files_updated_at BEFORE UPDATE ON drive_files FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: employees update_employees_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: leads update_leads_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: marketing_campaigns update_marketing_campaigns_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_marketing_campaigns_updated_at BEFORE UPDATE ON marketing_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: marketing_forms update_marketing_forms_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_marketing_forms_updated_at BEFORE UPDATE ON marketing_forms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: marketing_lists update_marketing_lists_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_marketing_lists_updated_at BEFORE UPDATE ON marketing_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: marketing_segments update_marketing_segments_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_marketing_segments_updated_at BEFORE UPDATE ON marketing_segments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: marketing_sequences update_marketing_sequences_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_marketing_sequences_updated_at BEFORE UPDATE ON marketing_sequences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: marketing_templates update_marketing_templates_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_marketing_templates_updated_at BEFORE UPDATE ON marketing_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: notification_templates update_notification_templates_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON notification_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: payroll update_payroll_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_payroll_updated_at BEFORE UPDATE ON payroll FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: project_risks update_project_risks_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_project_risks_updated_at BEFORE UPDATE ON project_risks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: project_tasks update_project_tasks_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON project_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: purchase_orders update_purchase_orders_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: roles update_roles_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: vendors update_vendors_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: warehouses update_warehouses_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: workflows update_workflows_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: workgroup_wiki update_workgroup_wiki_updated_at; Type: TRIGGER; Schema: public
--

CREATE TRIGGER update_workgroup_wiki_updated_at BEFORE UPDATE ON workgroup_wiki FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


--
-- Name: activities activities_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY activities
    ADD CONSTRAINT activities_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id);


--
-- Name: activities activities_company_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY activities
    ADD CONSTRAINT activities_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id);


--
-- Name: activities activities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY activities
    ADD CONSTRAINT activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id);


--
-- Name: activities activities_deal_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY activities
    ADD CONSTRAINT activities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id);


--
-- Name: activities activities_lead_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY activities
    ADD CONSTRAINT activities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id);


--
-- Name: activities activities_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY activities
    ADD CONSTRAINT activities_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: activities activities_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY activities
    ADD CONSTRAINT activities_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: activities activities_owner_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY activities
    ADD CONSTRAINT activities_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id);


--
-- Name: attendance attendance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY attendance
    ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;


--
-- Name: attendance attendance_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY attendance
    ADD CONSTRAINT attendance_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);


--
-- Name: attendance attendance_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY attendance
    ADD CONSTRAINT attendance_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: calendar_event_attendees calendar_event_attendees_event_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE;


--
-- Name: calendar_event_attendees calendar_event_attendees_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY calendar_events
    ADD CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: calendar_events calendar_events_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY calendar_events
    ADD CONSTRAINT calendar_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY calendar_events
    ADD CONSTRAINT calendar_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: call_logs call_logs_contact_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY call_logs
    ADD CONSTRAINT call_logs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id);


--
-- Name: call_logs call_logs_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY call_logs
    ADD CONSTRAINT call_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: call_logs call_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY call_logs
    ADD CONSTRAINT call_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: call_logs call_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY call_logs
    ADD CONSTRAINT call_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);


--
-- Name: companies companies_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY companies
    ADD CONSTRAINT companies_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: companies companies_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY companies
    ADD CONSTRAINT companies_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: companies companies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY companies
    ADD CONSTRAINT companies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: companies companies_owner_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY companies
    ADD CONSTRAINT companies_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id);


--
-- Name: connected_drives connected_drives_connected_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY connected_drives
    ADD CONSTRAINT connected_drives_connected_by_fkey FOREIGN KEY (connected_by) REFERENCES users(id);


--
-- Name: connected_drives connected_drives_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY connected_drives
    ADD CONSTRAINT connected_drives_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: connected_mailboxes connected_mailboxes_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY connected_mailboxes
    ADD CONSTRAINT connected_mailboxes_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: connected_mailboxes connected_mailboxes_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY connected_mailboxes
    ADD CONSTRAINT connected_mailboxes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY contacts
    ADD CONSTRAINT contacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: contacts contacts_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY contacts
    ADD CONSTRAINT contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);


--
-- Name: contacts contacts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY contacts
    ADD CONSTRAINT contacts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY contacts
    ADD CONSTRAINT contacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id);


--
-- Name: contacts contacts_responsible_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY contacts
    ADD CONSTRAINT contacts_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES users(id);


--
-- Name: customers customers_company_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY customers
    ADD CONSTRAINT customers_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id);


--
-- Name: customers customers_contact_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY customers
    ADD CONSTRAINT customers_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id);


--
-- Name: customers customers_converted_from_deal_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY customers
    ADD CONSTRAINT customers_converted_from_deal_id_fkey FOREIGN KEY (converted_from_deal_id) REFERENCES deals(id) ON DELETE SET NULL;


--
-- Name: customers customers_converted_from_lead_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY customers
    ADD CONSTRAINT customers_converted_from_lead_id_fkey FOREIGN KEY (converted_from_lead_id) REFERENCES leads(id) ON DELETE SET NULL;


--
-- Name: customers customers_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY customers
    ADD CONSTRAINT customers_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: customers customers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY customers
    ADD CONSTRAINT customers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: deal_contacts deal_contacts_contact_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deal_contacts
    ADD CONSTRAINT deal_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;


--
-- Name: deal_contacts deal_contacts_deal_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deal_contacts
    ADD CONSTRAINT deal_contacts_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;


--
-- Name: deal_contacts deal_contacts_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deal_contacts
    ADD CONSTRAINT deal_contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: deal_signing_parties deal_signing_parties_contact_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deal_signing_parties
    ADD CONSTRAINT deal_signing_parties_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;


--
-- Name: deal_signing_parties deal_signing_parties_deal_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deal_signing_parties
    ADD CONSTRAINT deal_signing_parties_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;


--
-- Name: deal_signing_parties deal_signing_parties_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deal_signing_parties
    ADD CONSTRAINT deal_signing_parties_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: deals deals_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deals
    ADD CONSTRAINT deals_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id);


--
-- Name: deals deals_company_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deals
    ADD CONSTRAINT deals_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id);


--
-- Name: deals deals_contact_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deals
    ADD CONSTRAINT deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id);


--
-- Name: deals deals_converted_from_lead_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deals
    ADD CONSTRAINT deals_converted_from_lead_id_fkey FOREIGN KEY (converted_from_lead_id) REFERENCES leads(id) ON DELETE SET NULL;


--
-- Name: deals deals_converted_to_customer_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deals
    ADD CONSTRAINT deals_converted_to_customer_id_fkey FOREIGN KEY (converted_to_customer_id) REFERENCES customers(id);


--
-- Name: deals deals_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deals
    ADD CONSTRAINT deals_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);


--
-- Name: deals deals_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deals
    ADD CONSTRAINT deals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: deals deals_owner_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deals
    ADD CONSTRAINT deals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id);


--
-- Name: deals deals_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY deals
    ADD CONSTRAINT deals_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workgroups(id) ON DELETE SET NULL;


--
-- Name: drive_activities drive_activities_file_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_activities
    ADD CONSTRAINT drive_activities_file_id_fkey FOREIGN KEY (file_id) REFERENCES drive_files(id) ON DELETE CASCADE;


--
-- Name: drive_activities drive_activities_folder_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_activities
    ADD CONSTRAINT drive_activities_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES drive_folders(id) ON DELETE CASCADE;


--
-- Name: drive_activities drive_activities_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_activities
    ADD CONSTRAINT drive_activities_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: drive_activities drive_activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_activities
    ADD CONSTRAINT drive_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: drive_file_versions drive_file_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_file_versions
    ADD CONSTRAINT drive_file_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: drive_file_versions drive_file_versions_file_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_file_versions
    ADD CONSTRAINT drive_file_versions_file_id_fkey FOREIGN KEY (file_id) REFERENCES drive_files(id) ON DELETE CASCADE;


--
-- Name: drive_files drive_files_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_files
    ADD CONSTRAINT drive_files_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: drive_files drive_files_folder_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_files
    ADD CONSTRAINT drive_files_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES drive_folders(id);


--
-- Name: drive_files drive_files_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_files
    ADD CONSTRAINT drive_files_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: drive_files drive_files_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_files
    ADD CONSTRAINT drive_files_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: drive_files drive_files_parent_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_files
    ADD CONSTRAINT drive_files_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES drive_files(id);


--
-- Name: drive_files drive_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_files
    ADD CONSTRAINT drive_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id);


--
-- Name: drive_folders drive_folders_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_folders
    ADD CONSTRAINT drive_folders_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: drive_folders drive_folders_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_folders
    ADD CONSTRAINT drive_folders_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: drive_folders drive_folders_parent_folder_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_folders
    ADD CONSTRAINT drive_folders_parent_folder_id_fkey FOREIGN KEY (parent_folder_id) REFERENCES drive_folders(id) ON DELETE CASCADE;


--
-- Name: drive_folders drive_folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_folders
    ADD CONSTRAINT drive_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES drive_folders(id) ON DELETE CASCADE;


--
-- Name: drive_permissions drive_permissions_drive_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_permissions
    ADD CONSTRAINT drive_permissions_drive_id_fkey FOREIGN KEY (drive_id) REFERENCES connected_drives(id) ON DELETE CASCADE;


--
-- Name: drive_permissions drive_permissions_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_permissions
    ADD CONSTRAINT drive_permissions_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: drive_permissions drive_permissions_role_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_permissions
    ADD CONSTRAINT drive_permissions_role_fkey FOREIGN KEY (role) REFERENCES roles(id);


--
-- Name: drive_permissions drive_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY drive_permissions
    ADD CONSTRAINT drive_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);


--
-- Name: emails emails_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY emails
    ADD CONSTRAINT emails_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: emails emails_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY emails
    ADD CONSTRAINT emails_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: emails emails_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY emails
    ADD CONSTRAINT emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE ONLY emails
    ADD CONSTRAINT emails_mailbox_id_fkey FOREIGN KEY (mailbox_id) REFERENCES connected_mailboxes(id) ON DELETE CASCADE;

ALTER TABLE ONLY emails
    ADD CONSTRAINT emails_message_id_key UNIQUE (message_id);

CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON emails USING btree (mailbox_id);


--
-- Name: employee_documents employee_documents_employee_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employee_documents
    ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;


--
-- Name: employee_documents employee_documents_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employee_documents
    ADD CONSTRAINT employee_documents_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: employee_documents employee_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employee_documents
    ADD CONSTRAINT employee_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id);


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;


--
-- Name: employee_leave_balances employee_leave_balances_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE;


--
-- Name: employee_leave_balances employee_leave_balances_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: employees employees_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: employees employees_manager_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES employees(id);


--
-- Name: employees employees_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);


--
-- Name: employees employees_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: employees employees_reporting_manager_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_reporting_manager_id_fkey FOREIGN KEY (reporting_manager_id) REFERENCES employees(id);


--
-- Name: employees employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);


--
-- Name: entity_drive_files entity_drive_files_linked_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY entity_drive_files
    ADD CONSTRAINT entity_drive_files_linked_by_fkey FOREIGN KEY (linked_by) REFERENCES users(id);


--
-- Name: entity_drive_files entity_drive_files_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY entity_drive_files
    ADD CONSTRAINT entity_drive_files_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: stock fk_stock_product; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock
    ADD CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;


--
-- Name: stock fk_stock_warehouse; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock
    ADD CONSTRAINT fk_stock_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE;


--
-- Name: hrms_notifications hrms_notifications_employee_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY hrms_notifications
    ADD CONSTRAINT hrms_notifications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;


--
-- Name: hrms_notifications hrms_notifications_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY hrms_notifications
    ADD CONSTRAINT hrms_notifications_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: hrms_notifications hrms_notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY hrms_notifications
    ADD CONSTRAINT hrms_notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY invoice_items
    ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);


--
-- Name: invoices invoices_contact_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY invoices
    ADD CONSTRAINT invoices_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id);


--
-- Name: invoices invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY invoices
    ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id);


--
-- Name: invoices invoices_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY invoices
    ADD CONSTRAINT invoices_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY invoices
    ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: lead_external_sources lead_external_sources_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY lead_external_sources
    ADD CONSTRAINT lead_external_sources_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: lead_external_sources lead_external_sources_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY lead_external_sources
    ADD CONSTRAINT lead_external_sources_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: lead_workspace_access lead_workspace_access_granted_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY lead_workspace_access
    ADD CONSTRAINT lead_workspace_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES users(id);


--
-- Name: lead_workspace_access lead_workspace_access_lead_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY lead_workspace_access
    ADD CONSTRAINT lead_workspace_access_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;


--
-- Name: lead_workspace_access lead_workspace_access_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY lead_workspace_access
    ADD CONSTRAINT lead_workspace_access_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workgroups(id) ON DELETE CASCADE;


--
-- Name: lead_workspaces lead_workspaces_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY lead_workspaces
    ADD CONSTRAINT lead_workspaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: lead_workspaces lead_workspaces_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY lead_workspaces
    ADD CONSTRAINT lead_workspaces_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: lead_workspaces lead_workspaces_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY lead_workspaces
    ADD CONSTRAINT lead_workspaces_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: leads leads_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leads
    ADD CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id);


--
-- Name: leads leads_contact_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leads
    ADD CONSTRAINT leads_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id);


--
-- Name: leads leads_converted_to_deal_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leads
    ADD CONSTRAINT leads_converted_to_deal_id_fkey FOREIGN KEY (converted_to_deal_id) REFERENCES deals(id);


--
-- Name: leads leads_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leads
    ADD CONSTRAINT leads_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);


--
-- Name: leads leads_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leads
    ADD CONSTRAINT leads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: leads leads_owner_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leads
    ADD CONSTRAINT leads_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id);


--
-- Name: leave_balances leave_balances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_balances
    ADD CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;


--
-- Name: leave_request_comments leave_request_comments_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_request_comments
    ADD CONSTRAINT leave_request_comments_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE;


--
-- Name: leave_request_comments leave_request_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_request_comments
    ADD CONSTRAINT leave_request_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);


--
-- Name: leave_requests leave_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_requests
    ADD CONSTRAINT leave_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id);


--
-- Name: leave_requests leave_requests_approver_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_requests
    ADD CONSTRAINT leave_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES users(id);


--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_requests
    ADD CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES leave_types(id);


--
-- Name: leave_requests leave_requests_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_requests
    ADD CONSTRAINT leave_requests_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_requests
    ADD CONSTRAINT leave_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: leave_types leave_types_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_types
    ADD CONSTRAINT leave_types_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: leave_types leave_types_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY leave_types
    ADD CONSTRAINT leave_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_test_results marketing_ab_test_results_contact_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_ab_test_results
    ADD CONSTRAINT marketing_ab_test_results_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_test_results marketing_ab_test_results_test_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_ab_test_results
    ADD CONSTRAINT marketing_ab_test_results_test_id_fkey FOREIGN KEY (test_id) REFERENCES marketing_ab_tests(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_test_results marketing_ab_test_results_variant_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_ab_test_results
    ADD CONSTRAINT marketing_ab_test_results_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES marketing_ab_test_variants(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_test_variants marketing_ab_test_variants_test_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_ab_test_variants
    ADD CONSTRAINT marketing_ab_test_variants_test_id_fkey FOREIGN KEY (test_id) REFERENCES marketing_ab_tests(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_tests marketing_ab_tests_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_ab_tests
    ADD CONSTRAINT marketing_ab_tests_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: marketing_ab_tests marketing_ab_tests_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_ab_tests
    ADD CONSTRAINT marketing_ab_tests_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_tests marketing_ab_tests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_ab_tests
    ADD CONSTRAINT marketing_ab_tests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_campaign_events marketing_campaign_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_campaign_events
    ADD CONSTRAINT marketing_campaign_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_campaign_events marketing_campaign_events_contact_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_campaign_events
    ADD CONSTRAINT marketing_campaign_events_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_campaigns marketing_campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: marketing_campaigns marketing_campaigns_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_campaigns marketing_campaigns_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_form_submissions marketing_form_submissions_contact_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_form_submissions
    ADD CONSTRAINT marketing_form_submissions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id);


--
-- Name: marketing_form_submissions marketing_form_submissions_form_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_form_submissions
    ADD CONSTRAINT marketing_form_submissions_form_id_fkey FOREIGN KEY (form_id) REFERENCES marketing_forms(id) ON DELETE CASCADE;


--
-- Name: marketing_forms marketing_forms_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_forms
    ADD CONSTRAINT marketing_forms_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: marketing_forms marketing_forms_list_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_forms
    ADD CONSTRAINT marketing_forms_list_id_fkey FOREIGN KEY (list_id) REFERENCES marketing_lists(id);


--
-- Name: marketing_forms marketing_forms_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_forms
    ADD CONSTRAINT marketing_forms_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_forms marketing_forms_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_forms
    ADD CONSTRAINT marketing_forms_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_list_members marketing_list_members_contact_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_list_members
    ADD CONSTRAINT marketing_list_members_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_list_members marketing_list_members_list_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_list_members
    ADD CONSTRAINT marketing_list_members_list_id_fkey FOREIGN KEY (list_id) REFERENCES marketing_lists(id) ON DELETE CASCADE;


--
-- Name: marketing_list_members marketing_list_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_list_members
    ADD CONSTRAINT marketing_list_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id);


--
-- Name: marketing_lists marketing_lists_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_lists
    ADD CONSTRAINT marketing_lists_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: marketing_lists marketing_lists_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_lists
    ADD CONSTRAINT marketing_lists_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_lists marketing_lists_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_lists
    ADD CONSTRAINT marketing_lists_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_scoring_history marketing_scoring_history_contact_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_scoring_history
    ADD CONSTRAINT marketing_scoring_history_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_scoring_history marketing_scoring_history_rule_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_scoring_history
    ADD CONSTRAINT marketing_scoring_history_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES marketing_scoring_rules(id);


--
-- Name: marketing_scoring_rules marketing_scoring_rules_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_scoring_rules
    ADD CONSTRAINT marketing_scoring_rules_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_scoring_rules marketing_scoring_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_scoring_rules
    ADD CONSTRAINT marketing_scoring_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_segments marketing_segments_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_segments
    ADD CONSTRAINT marketing_segments_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: marketing_segments marketing_segments_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_segments
    ADD CONSTRAINT marketing_segments_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_segments marketing_segments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_segments
    ADD CONSTRAINT marketing_segments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_sequence_enrollments marketing_sequence_enrollments_contact_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_sequence_enrollments
    ADD CONSTRAINT marketing_sequence_enrollments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_sequence_enrollments marketing_sequence_enrollments_sequence_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_sequence_enrollments
    ADD CONSTRAINT marketing_sequence_enrollments_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES marketing_sequences(id) ON DELETE CASCADE;


--
-- Name: marketing_sequence_steps marketing_sequence_steps_sequence_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_sequence_steps
    ADD CONSTRAINT marketing_sequence_steps_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES marketing_sequences(id) ON DELETE CASCADE;


--
-- Name: marketing_sequences marketing_sequences_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_sequences
    ADD CONSTRAINT marketing_sequences_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: marketing_sequences marketing_sequences_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_sequences
    ADD CONSTRAINT marketing_sequences_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_sequences marketing_sequences_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_sequences
    ADD CONSTRAINT marketing_sequences_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_templates marketing_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_templates
    ADD CONSTRAINT marketing_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: marketing_templates marketing_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_templates
    ADD CONSTRAINT marketing_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_templates marketing_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_templates
    ADD CONSTRAINT marketing_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_webhook_logs marketing_webhook_logs_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_webhook_logs
    ADD CONSTRAINT marketing_webhook_logs_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES marketing_webhooks(id) ON DELETE CASCADE;


--
-- Name: marketing_webhook_queue marketing_webhook_queue_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_webhook_queue
    ADD CONSTRAINT marketing_webhook_queue_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES marketing_webhooks(id) ON DELETE CASCADE;


--
-- Name: marketing_webhooks marketing_webhooks_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_webhooks
    ADD CONSTRAINT marketing_webhooks_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: marketing_webhooks marketing_webhooks_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_webhooks
    ADD CONSTRAINT marketing_webhooks_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_webhooks marketing_webhooks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY marketing_webhooks
    ADD CONSTRAINT marketing_webhooks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: notification_templates notification_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY notification_templates
    ADD CONSTRAINT notification_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: notification_templates notification_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY notification_templates
    ADD CONSTRAINT notification_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY notifications
    ADD CONSTRAINT notifications_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY notifications
    ADD CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: payroll payroll_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY payroll
    ADD CONSTRAINT payroll_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: payroll payroll_employee_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY payroll
    ADD CONSTRAINT payroll_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;


--
-- Name: payroll payroll_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY payroll
    ADD CONSTRAINT payroll_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: payroll payroll_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY payroll
    ADD CONSTRAINT payroll_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: product_batches product_batches_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY product_batches
    ADD CONSTRAINT product_batches_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: product_batches product_batches_product_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY product_batches
    ADD CONSTRAINT product_batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;


--
-- Name: product_batches product_batches_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY product_batches
    ADD CONSTRAINT product_batches_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES vendors(id);


--
-- Name: products products_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY products
    ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: products products_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY products
    ADD CONSTRAINT products_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: products products_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY products
    ADD CONSTRAINT products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: products products_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY products
    ADD CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES vendors(id);


--
-- Name: profiles profiles_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY profiles
    ADD CONSTRAINT profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: project_documents project_documents_project_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_documents
    ADD CONSTRAINT project_documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;


--
-- Name: project_documents project_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_documents
    ADD CONSTRAINT project_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id);


--
-- Name: project_milestones project_milestones_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_milestones
    ADD CONSTRAINT project_milestones_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: project_milestones project_milestones_project_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_milestones
    ADD CONSTRAINT project_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;


--
-- Name: project_risks project_risks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_risks
    ADD CONSTRAINT project_risks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id);


--
-- Name: project_risks project_risks_project_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_risks
    ADD CONSTRAINT project_risks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_tasks
    ADD CONSTRAINT project_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id);


--
-- Name: project_tasks project_tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_tasks
    ADD CONSTRAINT project_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: project_tasks project_tasks_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_tasks
    ADD CONSTRAINT project_tasks_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_tasks
    ADD CONSTRAINT project_tasks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_parent_task_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_tasks
    ADD CONSTRAINT project_tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES project_tasks(id);


--
-- Name: project_tasks project_tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_tasks
    ADD CONSTRAINT project_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;


--
-- Name: project_time_entries project_time_entries_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_time_entries
    ADD CONSTRAINT project_time_entries_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: project_time_entries project_time_entries_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_time_entries
    ADD CONSTRAINT project_time_entries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: project_time_entries project_time_entries_project_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_time_entries
    ADD CONSTRAINT project_time_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;


--
-- Name: project_time_entries project_time_entries_task_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_time_entries
    ADD CONSTRAINT project_time_entries_task_id_fkey FOREIGN KEY (task_id) REFERENCES project_tasks(id);


--
-- Name: project_time_entries project_time_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY project_time_entries
    ADD CONSTRAINT project_time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: projects projects_client_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY projects
    ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES customers(id);


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: projects projects_manager_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY projects
    ADD CONSTRAINT projects_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES users(id);


--
-- Name: projects projects_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY projects
    ADD CONSTRAINT projects_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: projects projects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY projects
    ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: projects projects_owner_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY projects
    ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id);


--
-- Name: public_holidays public_holidays_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY public_holidays
    ADD CONSTRAINT public_holidays_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY purchase_order_items
    ADD CONSTRAINT purchase_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY purchase_orders
    ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: purchase_orders purchase_orders_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY purchase_orders
    ADD CONSTRAINT purchase_orders_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY purchase_orders
    ADD CONSTRAINT purchase_orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY purchase_orders
    ADD CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY purchase_orders
    ADD CONSTRAINT purchase_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id);


--
-- Name: roles roles_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY roles
    ADD CONSTRAINT roles_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: roles roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY roles
    ADD CONSTRAINT roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: signing_parties signing_parties_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY signing_parties
    ADD CONSTRAINT signing_parties_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: signing_parties signing_parties_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY signing_parties
    ADD CONSTRAINT signing_parties_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: stock stock_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock
    ADD CONSTRAINT stock_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: stock_movements stock_movements_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock_movements
    ADD CONSTRAINT stock_movements_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock_movements
    ADD CONSTRAINT stock_movements_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock_movements
    ADD CONSTRAINT stock_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE;


--
-- Name: stock stock_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock
    ADD CONSTRAINT stock_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: stock stock_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock
    ADD CONSTRAINT stock_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: stock stock_product_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock
    ADD CONSTRAINT stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;


--
-- Name: stock stock_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY stock
    ADD CONSTRAINT stock_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: users users_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: vendors vendors_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY vendors
    ADD CONSTRAINT vendors_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: vendors vendors_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY vendors
    ADD CONSTRAINT vendors_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: vendors vendors_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY vendors
    ADD CONSTRAINT vendors_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: warehouses warehouses_manager_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY warehouses
    ADD CONSTRAINT warehouses_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES users(id);


--
-- Name: warehouses warehouses_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY warehouses
    ADD CONSTRAINT warehouses_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: warehouses warehouses_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY warehouses
    ADD CONSTRAINT warehouses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: workflow_actions workflow_actions_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workflow_actions
    ADD CONSTRAINT workflow_actions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE;


--
-- Name: workflow_execution_steps workflow_execution_steps_action_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workflow_execution_steps
    ADD CONSTRAINT workflow_execution_steps_action_id_fkey FOREIGN KEY (action_id) REFERENCES workflow_actions(id) ON DELETE CASCADE;


--
-- Name: workflow_execution_steps workflow_execution_steps_execution_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workflow_execution_steps
    ADD CONSTRAINT workflow_execution_steps_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE;


--
-- Name: workflow_executions workflow_executions_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workflow_executions
    ADD CONSTRAINT workflow_executions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE;


--
-- Name: workflows workflows_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workflows
    ADD CONSTRAINT workflows_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: workflows workflows_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workflows
    ADD CONSTRAINT workflows_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: workflows workflows_organization_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workflows
    ADD CONSTRAINT workflows_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: workgroup_activities workgroup_activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_activities
    ADD CONSTRAINT workgroup_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;


--
-- Name: workgroup_activities workgroup_activities_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_activities
    ADD CONSTRAINT workgroup_activities_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_channels workgroup_channels_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_channels
    ADD CONSTRAINT workgroup_channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: workgroup_channels workgroup_channels_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_channels
    ADD CONSTRAINT workgroup_channels_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_files workgroup_files_channel_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_files
    ADD CONSTRAINT workgroup_files_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES workgroup_channels(id) ON DELETE SET NULL;


--
-- Name: workgroup_files workgroup_files_post_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_files
    ADD CONSTRAINT workgroup_files_post_id_fkey FOREIGN KEY (post_id) REFERENCES workgroup_posts(id) ON DELETE SET NULL;


--
-- Name: workgroup_files workgroup_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_files
    ADD CONSTRAINT workgroup_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id);


--
-- Name: workgroup_files workgroup_files_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_files
    ADD CONSTRAINT workgroup_files_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_meeting_participants workgroup_meeting_participants_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_meeting_participants
    ADD CONSTRAINT workgroup_meeting_participants_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES workgroup_meetings(id) ON DELETE CASCADE;


--
-- Name: workgroup_meeting_participants workgroup_meeting_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_meeting_participants
    ADD CONSTRAINT workgroup_meeting_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: workgroup_meetings workgroup_meetings_channel_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_meetings
    ADD CONSTRAINT workgroup_meetings_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES workgroup_channels(id) ON DELETE SET NULL;


--
-- Name: workgroup_meetings workgroup_meetings_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_meetings
    ADD CONSTRAINT workgroup_meetings_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: workgroup_meetings workgroup_meetings_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_meetings
    ADD CONSTRAINT workgroup_meetings_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_members workgroup_members_invited_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_members
    ADD CONSTRAINT workgroup_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id);


--
-- Name: workgroup_members workgroup_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_members
    ADD CONSTRAINT workgroup_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: workgroup_members workgroup_members_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_members
    ADD CONSTRAINT workgroup_members_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_notifications workgroup_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_notifications
    ADD CONSTRAINT workgroup_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: workgroup_posts workgroup_posts_channel_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_posts
    ADD CONSTRAINT workgroup_posts_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES workgroup_channels(id) ON DELETE CASCADE;


--
-- Name: workgroup_posts workgroup_posts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_posts
    ADD CONSTRAINT workgroup_posts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES workgroup_posts(id) ON DELETE CASCADE;


--
-- Name: workgroup_posts workgroup_posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_posts
    ADD CONSTRAINT workgroup_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: workgroup_posts workgroup_posts_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_posts
    ADD CONSTRAINT workgroup_posts_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_wiki workgroup_wiki_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_wiki
    ADD CONSTRAINT workgroup_wiki_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_last_modified_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES users(id);


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_user_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_wiki workgroup_wiki_parent_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_wiki
    ADD CONSTRAINT workgroup_wiki_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES workgroup_wiki(id);


--
-- Name: workgroup_wiki workgroup_wiki_updated_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroup_wiki
    ADD CONSTRAINT workgroup_wiki_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);


--
-- Name: workgroups workgroups_created_by_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroups
    ADD CONSTRAINT workgroups_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);


--
-- Name: workgroups workgroups_org_id_fkey; Type: FK CONSTRAINT; Schema: public
--

ALTER TABLE ONLY workgroups
    ADD CONSTRAINT workgroups_org_id_fkey FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;


-- 
-- Migration: project_templates
-- 

CREATE TABLE IF NOT EXISTS project_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE INDEX idx_project_templates_org_id ON project_templates(org_id);
CREATE INDEX idx_project_templates_organization_id ON project_templates(organization_id);

CREATE TRIGGER update_project_templates_updated_at
    BEFORE UPDATE ON project_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


--
-- Name: project_invoices; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS project_invoices (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES organizations(id),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    invoice_number character varying(255) NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(10) DEFAULT 'USD',
    status character varying(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void', 'overdue', 'cancelled')),
    issue_date date NOT NULL,
    due_date date,
    paid_date date,
    description text,
    created_by uuid REFERENCES users(id),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: project_notifications; Type: TABLE; Schema: public
--

CREATE TABLE IF NOT EXISTS project_notifications (
    id uuid DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    org_id uuid NOT NULL,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title character varying(255) NOT NULL,
    message text,
    type character varying(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    read_at timestamp without time zone,
    data jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_project_invoices_project_id ON project_invoices(project_id);
CREATE INDEX idx_project_invoices_org_id ON project_invoices(org_id);
CREATE INDEX idx_project_notifications_user_project ON project_notifications(user_id, project_id);

CREATE TRIGGER update_project_invoices_updated_at
    BEFORE UPDATE ON project_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- Car Inventory Management System
-- Migration: Add Car Inventory Tables

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. CAR WORKSPACES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS car_workspaces (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  name character varying(255) NOT NULL,
  description text,
  workspace_type character varying(50) DEFAULT 'dealership', -- dealership, branch, showroom
  location character varying(255),
  address text,
  city character varying(100),
  state character varying(100),
  country character varying(100),
  postal_code character varying(20),
  phone character varying(50),
  email character varying(255),
  admin_id uuid, -- workspace admin user
  settings jsonb DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_workspaces_org ON car_workspaces(org_id);
CREATE INDEX idx_car_workspaces_admin ON car_workspaces(admin_id);

-- ============================================================================
-- 2. CAR INVENTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS car_inventory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES car_workspaces(id) ON DELETE CASCADE,
  
  -- Basic Info
  stock_number character varying(100) UNIQUE,
  vin character varying(17) UNIQUE, -- Vehicle Identification Number
  make character varying(100) NOT NULL, -- Toyota, Honda, BMW
  model character varying(100) NOT NULL, -- Corolla, Civic, X5
  year integer NOT NULL,
  trim_level character varying(100), -- EX, LX, Sport
  
  -- Specifications
  body_type character varying(50), -- Sedan, SUV, Truck, Coupe
  exterior_color character varying(50),
  interior_color character varying(50),
  transmission character varying(50), -- Automatic, Manual, CVT
  fuel_type character varying(50), -- Gasoline, Diesel, Electric, Hybrid
  engine_size character varying(50), -- 2.0L, 3.5L V6
  cylinders integer,
  drivetrain character varying(50), -- FWD, RWD, AWD, 4WD
  
  -- Condition & Mileage
  condition character varying(50) DEFAULT 'used', -- new, used, certified
  mileage integer DEFAULT 0, -- in KM or Miles
  mileage_unit character varying(10) DEFAULT 'km', -- km or miles
  
  -- Pricing
  purchase_price numeric(12,2), -- what we bought it for
  selling_price numeric(12,2) NOT NULL, -- listing price
  msrp numeric(12,2), -- Manufacturer's Suggested Retail Price
  currency character varying(10) DEFAULT 'USD',
  
  -- Status
  status character varying(50) DEFAULT 'available', -- available, sold, reserved, pending, service
  availability_date date,
  sold_date date,
  reserved_by uuid, -- customer/contact id
  reserved_until timestamp without time zone,
  
  -- Features & Options
  features jsonb DEFAULT '[]', -- ["Sunroof", "Leather Seats", "Navigation"]
  standard_features text,
  optional_features text,
  
  -- Technical Details
  doors integer,
  seats integer,
  mpg_city numeric(5,2), -- Miles per gallon city
  mpg_highway numeric(5,2), -- Miles per gallon highway
  horsepower integer,
  torque integer,
  
  -- History & Documentation
  previous_owners integer DEFAULT 0,
  accident_history boolean DEFAULT false,
  service_history text,
  warranty_info text,
  registration_number character varying(100),
  registration_expiry date,
  insurance_expiry date,
  
  -- Media
  primary_image character varying(500),
  images jsonb DEFAULT '[]', -- array of image URLs
  video_url character varying(500),
  
  -- Location
  location character varying(255), -- Lot A, Showroom Floor
  warehouse_id uuid, -- if using existing warehouses table
  
  -- Additional Info
  description text,
  internal_notes text, -- private notes for staff
  tags character varying[] DEFAULT '{}',
  
  -- Metadata
  created_by uuid,
  updated_by uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_inventory_org ON car_inventory(org_id);
CREATE INDEX idx_car_inventory_workspace ON car_inventory(workspace_id);
CREATE INDEX idx_car_inventory_status ON car_inventory(status);
CREATE INDEX idx_car_inventory_make_model ON car_inventory(make, model);
CREATE INDEX idx_car_inventory_year ON car_inventory(year);
CREATE INDEX idx_car_inventory_vin ON car_inventory(vin);
CREATE INDEX idx_car_inventory_stock ON car_inventory(stock_number);

-- ============================================================================
-- 3. CAR DOCUMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS car_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  car_id uuid NOT NULL REFERENCES car_inventory(id) ON DELETE CASCADE,
  document_type character varying(100) NOT NULL, -- registration, insurance, inspection, title
  document_name character varying(255) NOT NULL,
  file_url character varying(500) NOT NULL,
  file_size integer,
  mime_type character varying(100),
  expiry_date date,
  notes text,
  uploaded_by uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_documents_car ON car_documents(car_id);
CREATE INDEX idx_car_documents_type ON car_documents(document_type);

-- ============================================================================
-- 4. CAR INQUIRIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS car_inquiries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES car_workspaces(id) ON DELETE CASCADE,
  car_id uuid NOT NULL REFERENCES car_inventory(id) ON DELETE CASCADE,
  
  -- Customer Info
  customer_name character varying(255) NOT NULL,
  customer_email character varying(255),
  customer_phone character varying(50),
  contact_id uuid, -- link to existing contact if available
  
  -- Inquiry Details
  inquiry_type character varying(50) DEFAULT 'general', -- general, test_drive, purchase, trade_in
  message text,
  preferred_contact_method character varying(50), -- email, phone, whatsapp
  preferred_contact_time character varying(100),
  
  -- Status
  status character varying(50) DEFAULT 'new', -- new, contacted, scheduled, completed, closed
  priority character varying(50) DEFAULT 'medium', -- low, medium, high
  assigned_to uuid, -- sales rep
  
  -- Follow-up
  follow_up_date date,
  follow_up_notes text,
  
  -- Metadata
  source character varying(100), -- website, phone, walk-in, referral
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_inquiries_workspace ON car_inquiries(workspace_id);
CREATE INDEX idx_car_inquiries_car ON car_inquiries(car_id);
CREATE INDEX idx_car_inquiries_status ON car_inquiries(status);
CREATE INDEX idx_car_inquiries_assigned ON car_inquiries(assigned_to);

-- ============================================================================
-- 5. CAR TEST DRIVES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS car_test_drives (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES car_workspaces(id) ON DELETE CASCADE,
  car_id uuid NOT NULL REFERENCES car_inventory(id) ON DELETE CASCADE,
  inquiry_id uuid REFERENCES car_inquiries(id) ON DELETE SET NULL,
  
  -- Customer Info
  customer_name character varying(255) NOT NULL,
  customer_email character varying(255),
  customer_phone character varying(50) NOT NULL,
  customer_license character varying(100), -- driver's license number
  contact_id uuid,
  
  -- Schedule
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  duration_minutes integer DEFAULT 30,
  
  -- Status
  status character varying(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
  
  -- Details
  start_mileage integer,
  end_mileage integer,
  route_taken text,
  sales_rep uuid, -- assigned sales representative
  notes text,
  customer_feedback text,
  interested_level character varying(50), -- low, medium, high
  
  -- Follow-up
  follow_up_required boolean DEFAULT true,
  follow_up_date date,
  
  -- Metadata
  created_by uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamp without time zone
);

CREATE INDEX idx_car_test_drives_workspace ON car_test_drives(workspace_id);
CREATE INDEX idx_car_test_drives_car ON car_test_drives(car_id);
CREATE INDEX idx_car_test_drives_date ON car_test_drives(scheduled_date);
CREATE INDEX idx_car_test_drives_status ON car_test_drives(status);

-- ============================================================================
-- 6. CAR SALES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS car_sales (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  workspace_id uuid NOT NULL REFERENCES car_workspaces(id) ON DELETE CASCADE,
  car_id uuid NOT NULL REFERENCES car_inventory(id) ON DELETE RESTRICT,
  
  -- Sale Info
  sale_number character varying(100) UNIQUE,
  sale_date date NOT NULL,
  
  -- Customer
  customer_name character varying(255) NOT NULL,
  customer_email character varying(255),
  customer_phone character varying(50),
  customer_address text,
  contact_id uuid,
  
  -- Pricing
  sale_price numeric(12,2) NOT NULL,
  down_payment numeric(12,2) DEFAULT 0,
  trade_in_value numeric(12,2) DEFAULT 0,
  trade_in_vehicle character varying(255),
  financing_amount numeric(12,2) DEFAULT 0,
  financing_term integer, -- months
  interest_rate numeric(5,2),
  monthly_payment numeric(12,2),
  
  -- Fees & Taxes
  tax_amount numeric(12,2) DEFAULT 0,
  registration_fee numeric(12,2) DEFAULT 0,
  documentation_fee numeric(12,2) DEFAULT 0,
  other_fees numeric(12,2) DEFAULT 0,
  total_amount numeric(12,2) NOT NULL,
  
  -- Payment
  payment_method character varying(50), -- cash, finance, lease, bank_transfer
  payment_status character varying(50) DEFAULT 'pending', -- pending, partial, paid
  amount_paid numeric(12,2) DEFAULT 0,
  balance_due numeric(12,2),
  
  -- Delivery
  delivery_date date,
  delivery_status character varying(50) DEFAULT 'pending', -- pending, ready, delivered
  
  -- Staff
  sales_rep uuid, -- who made the sale
  finance_manager uuid,
  
  -- Documents
  contract_signed boolean DEFAULT false,
  contract_url character varying(500),
  
  -- Notes
  notes text,
  
  -- Metadata
  created_by uuid,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_sales_workspace ON car_sales(workspace_id);
CREATE INDEX idx_car_sales_car ON car_sales(car_id);
CREATE INDEX idx_car_sales_date ON car_sales(sale_date);
CREATE INDEX idx_car_sales_status ON car_sales(payment_status);

-- ============================================================================
-- 7. CAR SERVICE HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS car_service_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  car_id uuid NOT NULL REFERENCES car_inventory(id) ON DELETE CASCADE,
  
  service_date date NOT NULL,
  service_type character varying(100) NOT NULL, -- maintenance, repair, inspection, detailing
  description text NOT NULL,
  mileage_at_service integer,
  cost numeric(10,2),
  service_provider character varying(255), -- internal or external shop
  invoice_number character varying(100),
  next_service_due date,
  next_service_mileage integer,
  
  performed_by uuid,
  notes text,
  
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_service_car ON car_service_history(car_id);
CREATE INDEX idx_car_service_date ON car_service_history(service_date);

-- ============================================================================
-- 8. CAR WORKSPACE MEMBERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS car_workspace_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES car_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role character varying(50) DEFAULT 'member', -- admin, manager, sales_rep, viewer
  permissions jsonb DEFAULT '{}',
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX idx_car_workspace_members_workspace ON car_workspace_members(workspace_id);
CREATE INDEX idx_car_workspace_members_user ON car_workspace_members(user_id);

-- ============================================================================
-- 9. CAR ACTIVITY LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS car_activity_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id uuid NOT NULL,
  workspace_id uuid REFERENCES car_workspaces(id) ON DELETE CASCADE,
  car_id uuid REFERENCES car_inventory(id) ON DELETE CASCADE,
  
  activity_type character varying(100) NOT NULL, -- created, updated, sold, reserved, inquiry, test_drive
  description text NOT NULL,
  changes jsonb, -- track what changed
  
  user_id uuid,
  user_name character varying(255),
  
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_car_activity_workspace ON car_activity_log(workspace_id);
CREATE INDEX idx_car_activity_car ON car_activity_log(car_id);
CREATE INDEX idx_car_activity_type ON car_activity_log(activity_type);
CREATE INDEX idx_car_activity_date ON car_activity_log(created_at);

-- ============================================================================
-- SEED DATA: Create Default Workspaces
-- ============================================================================

-- Note: Update org_id with your actual organization ID
-- You can get it by running: SELECT id FROM organizations LIMIT 1;

-- Uncomment and update these lines after getting your org_id:
-- INSERT INTO car_workspaces (org_id, name, description, workspace_type, is_active) VALUES
-- ('your-org-id-here', 'Biwords Auto', 'Main dealership for Biwords', 'dealership', true),
-- ('your-org-id-here', 'Motors 1', 'First motors branch', 'branch', true),
-- ('your-org-id-here', 'Motors 2', 'Second motors branch', 'branch', true),
-- ('your-org-id-here', 'Motors 3', 'Third motors branch', 'branch', true);

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_car_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER car_inventory_updated_at BEFORE UPDATE ON car_inventory
  FOR EACH ROW EXECUTE FUNCTION update_car_updated_at();

CREATE TRIGGER car_workspaces_updated_at BEFORE UPDATE ON car_workspaces
  FOR EACH ROW EXECUTE FUNCTION update_car_updated_at();

CREATE TRIGGER car_inquiries_updated_at BEFORE UPDATE ON car_inquiries
  FOR EACH ROW EXECUTE FUNCTION update_car_updated_at();

CREATE TRIGGER car_test_drives_updated_at BEFORE UPDATE ON car_test_drives
  FOR EACH ROW EXECUTE FUNCTION update_car_updated_at();

CREATE TRIGGER car_sales_updated_at BEFORE UPDATE ON car_sales
  FOR EACH ROW EXECUTE FUNCTION update_car_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE car_workspaces IS 'Separate workspaces for different dealerships/branches';
COMMENT ON TABLE car_inventory IS 'Main car inventory with all vehicle details';
COMMENT ON TABLE car_inquiries IS 'Customer inquiries about specific cars';
COMMENT ON TABLE car_test_drives IS 'Test drive bookings and history';
COMMENT ON TABLE car_sales IS 'Completed car sales transactions';
COMMENT ON TABLE car_service_history IS 'Service and maintenance history for each car';
COMMENT ON TABLE car_workspace_members IS 'Users assigned to specific workspaces';
COMMENT ON TABLE car_activity_log IS 'Activity tracking for audit trail';

-- =====================================================
-- RECRUITMENT MANAGEMENT SYSTEM TABLES
-- =====================================================
-- Added: 2026-04-09T14:32:37.277Z
-- Description: Complete recruitment module with job requisitions,
--              candidates, interviews, and application forms
-- =====================================================

-- Recruitment Management System Tables
-- Migration: 20260409_create_recruitment_tables.sql

-- 1. Job Requisitions Table
CREATE TABLE IF NOT EXISTS job_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id VARCHAR(50) UNIQUE NOT NULL,
    position VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    number_of_positions INTEGER NOT NULL DEFAULT 1,
    job_description TEXT NOT NULL,
    requirements TEXT,
    request_type VARCHAR(50) DEFAULT 'single', -- single, team, other
    urgency VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
    grade VARCHAR(50), -- GD level
    status VARCHAR(50) DEFAULT 'pending_dept_head', -- pending_dept_head, pending_hr, pending_management, approved, rejected, in_advertisement, shortlisting, interviewing, completed
    requested_by UUID REFERENCES users(id),
    requested_by_name VARCHAR(255),
    requested_by_email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- 2. Requisition Approval Workflow Table
CREATE TABLE IF NOT EXISTS requisition_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID REFERENCES job_requisitions(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    role VARCHAR(100) NOT NULL, -- Requester, Department Head, HR Manager, Higher Authority
    approver_id UUID REFERENCES users(id),
    approver_name VARCHAR(255),
    approver_email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'not_started', -- not_started, pending, completed, rejected
    action VARCHAR(50), -- submitted, approved, rejected, forwarded
    comments TEXT,
    action_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(requisition_id, step_number)
);

-- 3. Job Advertisements Table
CREATE TABLE IF NOT EXISTS job_advertisements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID REFERENCES job_requisitions(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    benefits TEXT,
    application_deadline DATE,
    status VARCHAR(50) DEFAULT 'draft', -- draft, published, closed
    published_date TIMESTAMP,
    published_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Candidates Table
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID REFERENCES job_requisitions(id),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    alternate_phone VARCHAR(50),
    cnic VARCHAR(50),
    date_of_birth DATE,
    gender VARCHAR(20),
    marital_status VARCHAR(50),
    nationality VARCHAR(100) DEFAULT 'Pakistani',
    religion VARCHAR(50),
    current_address TEXT,
    permanent_address TEXT,
    
    -- Education
    highest_qualification VARCHAR(255),
    university VARCHAR(255),
    graduation_year INTEGER,
    cgpa VARCHAR(20),
    
    -- Experience
    total_experience VARCHAR(100),
    current_company VARCHAR(255),
    current_designation VARCHAR(255),
    current_salary VARCHAR(100),
    expected_salary VARCHAR(100),
    notice_period VARCHAR(100),
    
    -- Position Details
    applied_position VARCHAR(255),
    grade VARCHAR(50),
    department VARCHAR(100),
    
    -- References
    reference1_name VARCHAR(255),
    reference1_contact VARCHAR(100),
    reference1_relation VARCHAR(100),
    reference2_name VARCHAR(255),
    reference2_contact VARCHAR(100),
    reference2_relation VARCHAR(100),
    
    -- Emergency Contact
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(100),
    emergency_contact_relation VARCHAR(100),
    
    -- CV & Documents
    cv_url TEXT,
    cv_filename VARCHAR(255),
    
    -- Public Form Access (for digital form filling)
    form_token VARCHAR(255),
    form_token_expires_at TIMESTAMP,
    father_name VARCHAR(255),
    father_occupation VARCHAR(255),
    mobile_no VARCHAR(50),
    blood_group VARCHAR(10),
    number_of_children INTEGER DEFAULT 0,
    residence_type VARCHAR(50),
    academic_records JSONB,
    work_experience JSONB,
    joining_availability VARCHAR(255),
    
    -- Status & Tracking
    status VARCHAR(50) DEFAULT 'cv_received', -- cv_received, screened_passed, screened_failed, shortlisted, interview_scheduled, interviewed, form_completed, final_round, selected, rejected
    source VARCHAR(100), -- job_board, referral, direct, cv_upload, etc.
    skills TEXT[], -- Array of skills
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- Create index on form_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_candidates_form_token ON candidates(form_token);

-- 5. Application Forms Table
CREATE TABLE IF NOT EXISTS candidate_application_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    requisition_id UUID REFERENCES job_requisitions(id),
    form_data JSONB NOT NULL, -- Complete form data in JSON format
    status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, reviewed
    generated_by UUID REFERENCES users(id),
    submitted_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Interviews Table
CREATE TABLE IF NOT EXISTS candidate_interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    requisition_id UUID REFERENCES job_requisitions(id),
    interview_type VARCHAR(50) NOT NULL, -- technical, hr, final
    interview_date DATE,
    interview_time TIME,
    interviewer_id UUID REFERENCES users(id),
    interviewer_name VARCHAR(255),
    
    -- Evaluation
    technical_skills TEXT,
    communication TEXT,
    problem_solving TEXT,
    culture_fit TEXT,
    overall_remarks TEXT,
    recommendation VARCHAR(50), -- strongly_recommend, recommend, maybe, not_recommend, reject
    
    -- Status
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, completed, cancelled
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Interview Feedback Table (for collaborative hiring)
CREATE TABLE IF NOT EXISTS interview_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID REFERENCES candidate_interviews(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id),
    feedback_by UUID REFERENCES users(id),
    feedback_by_name VARCHAR(255),
    feedback_by_role VARCHAR(100),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comments TEXT,
    recommendation VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. Candidate Timeline/Activity Log
CREATE TABLE IF NOT EXISTS candidate_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    activity_type VARCHAR(100) NOT NULL, -- application_received, shortlisted, interview_scheduled, interviewed, selected, rejected
    description TEXT,
    performed_by UUID REFERENCES users(id),
    performed_by_name VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for Performance
CREATE INDEX idx_requisitions_status ON job_requisitions(status);
CREATE INDEX idx_requisitions_org ON job_requisitions(organization_id);
CREATE INDEX idx_requisitions_created ON job_requisitions(created_at DESC);
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_requisition ON candidates(requisition_id);
CREATE INDEX idx_candidates_org ON candidates(organization_id);
CREATE INDEX idx_interviews_candidate ON candidate_interviews(candidate_id);
CREATE INDEX idx_interviews_date ON candidate_interviews(interview_date);
CREATE INDEX idx_timeline_candidate ON candidate_timeline(candidate_id);
CREATE INDEX idx_approvals_requisition ON requisition_approvals(requisition_id);

-- Add Comments
COMMENT ON TABLE job_requisitions IS 'Stores job requisition requests from departments';
COMMENT ON TABLE requisition_approvals IS 'Tracks approval workflow for requisitions';
COMMENT ON TABLE job_advertisements IS 'Published job advertisements';
COMMENT ON TABLE candidates IS 'Candidate information and applications';
COMMENT ON TABLE candidate_application_forms IS 'Generated application forms for candidates';
COMMENT ON TABLE candidate_interviews IS 'Interview records and evaluations';
COMMENT ON TABLE interview_feedback IS 'Collaborative feedback from multiple interviewers';
COMMENT ON TABLE candidate_timeline IS 'Activity log for candidate journey';


-- =====================================================
-- END OF RECRUITMENT MANAGEMENT SYSTEM
-- =====================================================


-- =====================================================
-- ADVANCED RECRUITMENT FEATURES
-- =====================================================

-- =====================================================
-- 1. OFFER MANAGEMENT SYSTEM
-- =====================================================

-- Job Offers Table
CREATE TABLE IF NOT EXISTS job_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    requisition_id UUID REFERENCES job_requisitions(id),
    offer_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Position Details
    position VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    grade VARCHAR(50),
    reporting_manager VARCHAR(255),
    work_location VARCHAR(255),
    employment_type VARCHAR(50) DEFAULT 'full_time', -- full_time, part_time, contract, internship
    
    -- Compensation Package
    base_salary DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'PKR',
    salary_frequency VARCHAR(20) DEFAULT 'monthly', -- monthly, annual
    bonus_percentage DECIMAL(5,2),
    allowances JSONB, -- {housing: 50000, transport: 15000, medical: 25000}
    benefits TEXT,
    
    -- Offer Terms
    start_date DATE NOT NULL,
    probation_period INTEGER DEFAULT 90, -- days
    notice_period INTEGER DEFAULT 30, -- days
    working_hours VARCHAR(50) DEFAULT '9 AM - 6 PM',
    
    -- Offer Status & Timeline
    status VARCHAR(50) DEFAULT 'draft', -- draft, pending_approval, approved, sent, accepted, rejected, withdrawn, expired
    offer_sent_date TIMESTAMP,
    response_deadline DATE,
    accepted_date TIMESTAMP,
    rejected_date TIMESTAMP,
    rejection_reason TEXT,
    
    -- Approval Workflow
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_date TIMESTAMP,
    
    -- Additional Terms
    special_conditions TEXT,
    offer_letter_template TEXT,
    offer_letter_url TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- Offer Approval Workflow
CREATE TABLE IF NOT EXISTS offer_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID REFERENCES job_offers(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    approver_role VARCHAR(100) NOT NULL, -- HR Manager, Department Head, Finance, CEO
    approver_id UUID REFERENCES users(id),
    approver_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    comments TEXT,
    action_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(offer_id, step_number)
);

-- =====================================================
-- 2. CANDIDATE SCORING & RANKING SYSTEM
-- =====================================================

-- Scoring Criteria Templates
CREATE TABLE IF NOT EXISTS scoring_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    criteria_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- technical, behavioral, experience, education
    description TEXT,
    max_score INTEGER DEFAULT 100,
    weight_percentage DECIMAL(5,2) DEFAULT 100.00,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- Candidate Scores
CREATE TABLE IF NOT EXISTS candidate_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    criteria_id UUID REFERENCES scoring_criteria(id),
    interview_id UUID REFERENCES candidate_interviews(id),
    
    -- Scoring Details
    raw_score INTEGER CHECK (raw_score >= 0 AND raw_score <= 100),
    weighted_score DECIMAL(8,2),
    comments TEXT,
    
    -- Scorer Information
    scored_by UUID REFERENCES users(id),
    scorer_name VARCHAR(255),
    scorer_role VARCHAR(100),
    
    -- Metadata
    scored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint for ON CONFLICT
    UNIQUE(candidate_id, criteria_id, scored_by)
);

-- Overall Candidate Rankings
CREATE TABLE IF NOT EXISTS candidate_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    requisition_id UUID REFERENCES job_requisitions(id),
    
    -- Ranking Details
    total_score DECIMAL(8,2),
    rank_position INTEGER,
    percentile DECIMAL(5,2),
    
    -- Score Breakdown
    technical_score DECIMAL(8,2),
    behavioral_score DECIMAL(8,2),
    experience_score DECIMAL(8,2),
    education_score DECIMAL(8,2),
    
    -- Ranking Status
    is_current BOOLEAN DEFAULT true,
    ranking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    calculated_by UUID REFERENCES users(id),
    
    -- Unique constraint for ON CONFLICT
    UNIQUE(candidate_id, requisition_id)
);

-- =====================================================
-- 3. TALENT POOL MANAGEMENT
-- =====================================================

-- Talent Pools
CREATE TABLE IF NOT EXISTS talent_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_name VARCHAR(255) NOT NULL,
    description TEXT,
    pool_type VARCHAR(50) DEFAULT 'skill_based', -- skill_based, department_based, level_based, custom
    
    -- Pool Criteria
    target_skills TEXT[],
    target_departments TEXT[],
    target_experience_min INTEGER, -- years
    target_experience_max INTEGER, -- years
    target_education_level VARCHAR(100),
    
    -- Pool Management
    created_by UUID REFERENCES users(id),
    managed_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- Talent Pool Members
CREATE TABLE IF NOT EXISTS talent_pool_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID REFERENCES talent_pools(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    
    -- Membership Details
    added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, hired_elsewhere, not_interested
    
    -- Engagement Tracking
    last_contacted DATE,
    contact_frequency VARCHAR(50), -- weekly, monthly, quarterly
    notes TEXT,
    
    -- Performance in Pool
    pool_score DECIMAL(8,2),
    availability_status VARCHAR(50) DEFAULT 'available', -- available, not_available, considering_offers
    
    UNIQUE(pool_id, candidate_id)
);

-- =====================================================
-- 4. JOB TEMPLATES SYSTEM
-- =====================================================

-- Job Description Templates
CREATE TABLE IF NOT EXISTS job_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(255) NOT NULL,
    template_code VARCHAR(50) UNIQUE NOT NULL,
    
    -- Template Classification
    department VARCHAR(100),
    position_level VARCHAR(50), -- entry, mid, senior, executive
    job_family VARCHAR(100), -- engineering, sales, marketing, hr
    grade VARCHAR(50),
    
    -- Template Content
    job_title_template VARCHAR(255),
    job_description_template TEXT,
    key_responsibilities TEXT,
    required_qualifications TEXT,
    preferred_qualifications TEXT,
    required_skills TEXT[],
    preferred_skills TEXT[],
    
    -- Compensation Guidelines
    salary_range_min DECIMAL(12,2),
    salary_range_max DECIMAL(12,2),
    standard_benefits TEXT,
    
    -- Template Metadata
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    last_used_date TIMESTAMP,
    
    -- Version Control
    version VARCHAR(10) DEFAULT '1.0',
    parent_template_id UUID REFERENCES job_templates(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID REFERENCES organizations(id)
);

-- =====================================================
-- 5. BACKGROUND VERIFICATION SYSTEM
-- =====================================================

-- Background Check Types
CREATE TABLE IF NOT EXISTS background_check_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_type_name VARCHAR(100) NOT NULL,
    check_category VARCHAR(50) NOT NULL, -- education, employment, criminal, reference, identity, credit
    description TEXT,
    is_mandatory BOOLEAN DEFAULT false,
    typical_duration_days INTEGER DEFAULT 7,
    cost_estimate DECIMAL(10,2),
    vendor_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    organization_id UUID REFERENCES organizations(id)
);

-- Background Checks
CREATE TABLE IF NOT EXISTS background_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    check_type_id UUID REFERENCES background_check_types(id),
    
    -- Check Details
    check_reference_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed, cancelled
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    
    -- Timeline
    initiated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_completion_date DATE,
    completed_date TIMESTAMP,
    
    -- Results
    result VARCHAR(50), -- clear, concerns_found, failed, inconclusive
    result_details TEXT,
    verification_score INTEGER CHECK (verification_score >= 0 AND verification_score <= 100),
    
    -- Verification Details
    verified_by VARCHAR(255), -- External agency or internal team
    verification_method VARCHAR(100),
    documents_verified TEXT[],
    
    -- Cost & Vendor
    cost_incurred DECIMAL(10,2),
    vendor_used VARCHAR(255),
    vendor_reference VARCHAR(100),
    
    -- Internal Tracking
    initiated_by UUID REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    review_comments TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 6. ANALYTICS & METRICS TABLES
-- =====================================================

-- Recruitment Metrics
CREATE TABLE IF NOT EXISTS recruitment_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(100) NOT NULL, -- time_to_hire, cost_per_hire, source_effectiveness, etc.
    metric_period VARCHAR(50) NOT NULL, -- daily, weekly, monthly, quarterly, yearly
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    
    -- Metric Values
    metric_value DECIMAL(15,4),
    metric_unit VARCHAR(50), -- days, currency, percentage, count
    
    -- Dimensions
    department VARCHAR(100),
    position_level VARCHAR(50),
    requisition_id UUID REFERENCES job_requisitions(id),
    
    -- Metadata
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    calculated_by UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id)
);

-- Source Effectiveness Tracking
CREATE TABLE IF NOT EXISTS recruitment_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name VARCHAR(100) NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- job_board, social_media, referral, direct, agency
    source_url VARCHAR(500),
    
    -- Effectiveness Metrics
    total_applications INTEGER DEFAULT 0,
    qualified_applications INTEGER DEFAULT 0,
    interviews_scheduled INTEGER DEFAULT 0,
    offers_made INTEGER DEFAULT 0,
    hires_made INTEGER DEFAULT 0,
    
    -- Cost Metrics
    cost_per_application DECIMAL(10,2),
    cost_per_hire DECIMAL(10,2),
    
    -- Performance Metrics
    quality_score DECIMAL(5,2), -- Based on hire success rate
    time_to_fill_avg DECIMAL(8,2), -- Average days
    
    is_active BOOLEAN DEFAULT true,
    organization_id UUID REFERENCES organizations(id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Offer Management Indexes
CREATE INDEX idx_job_offers_candidate ON job_offers(candidate_id);
CREATE INDEX idx_job_offers_status ON job_offers(status);
CREATE INDEX idx_job_offers_created_date ON job_offers(created_at DESC);

-- Scoring System Indexes
CREATE INDEX idx_candidate_scores_candidate ON candidate_scores(candidate_id);
CREATE INDEX idx_candidate_rankings_requisition ON candidate_rankings(requisition_id);
CREATE INDEX idx_candidate_rankings_score ON candidate_rankings(total_score DESC);

-- Talent Pool Indexes
CREATE INDEX idx_talent_pool_members_pool ON talent_pool_members(pool_id);
CREATE INDEX idx_talent_pool_members_candidate ON talent_pool_members(candidate_id);
CREATE INDEX idx_talent_pool_members_status ON talent_pool_members(status);

-- Background Check Indexes
CREATE INDEX idx_background_checks_candidate ON background_checks(candidate_id);
CREATE INDEX idx_background_checks_status ON background_checks(status);
CREATE INDEX idx_background_checks_completion ON background_checks(expected_completion_date);

-- Analytics Indexes
CREATE INDEX idx_recruitment_metrics_type_period ON recruitment_metrics(metric_type, period_start_date);
CREATE INDEX idx_recruitment_sources_effectiveness ON recruitment_sources(quality_score DESC);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE job_offers IS 'Comprehensive offer management with approval workflow';
COMMENT ON TABLE candidate_scores IS 'Multi-criteria candidate scoring system';
COMMENT ON TABLE talent_pools IS 'Talent pool management for future opportunities';
COMMENT ON TABLE job_templates IS 'Standardized job description templates';
COMMENT ON TABLE background_checks IS 'Background verification and compliance tracking';
COMMENT ON TABLE recruitment_metrics IS 'Analytics and KPI tracking for recruitment process';

-- =====================================================
-- DEFAULT DATA SETUP
-- =====================================================

-- -- Insert Default Scoring Criteria
-- INSERT INTO scoring_criteria (criteria_name, category, description, max_score, weight_percentage, organization_id) VALUES
-- ('Technical Skills', 'technical', 'Assessment of job-specific technical competencies', 100, 30.00, NULL),
-- ('Communication Skills', 'behavioral', 'Verbal and written communication effectiveness', 100, 20.00, NULL),
-- ('Problem Solving', 'behavioral', 'Analytical thinking and problem resolution abilities', 100, 25.00, NULL),
-- ('Cultural Fit', 'behavioral', 'Alignment with company values and team dynamics', 100, 15.00, NULL),
-- ('Experience Relevance', 'experience', 'Relevance and depth of previous work experience', 100, 10.00, NULL);

-- -- Insert Default Background Check Types
-- INSERT INTO background_check_types (check_type_name, check_category, description, is_mandatory, typical_duration_days) VALUES
-- ('Education Verification', 'education', 'Verify educational qualifications and degrees', true, 5),
-- ('Employment History', 'employment', 'Verify previous employment and references', true, 7),
-- ('Identity Verification', 'identity', 'Verify identity documents (CNIC, Passport)', true, 2),
-- ('Reference Check', 'reference', 'Contact and verify professional references', false, 3),
-- ('Criminal Background', 'criminal', 'Check for criminal history and legal issues', false, 10);

-- -- Insert Default Recruitment Sources
-- INSERT INTO recruitment_sources (source_name, source_type, source_url) VALUES
-- ('LinkedIn', 'social_media', 'https://linkedin.com'),
-- ('Indeed', 'job_board', 'https://indeed.com'),
-- ('Employee Referral', 'referral', NULL),
-- ('Company Website', 'direct', NULL),
-- ('University Campus', 'direct', NULL),
-- ('Recruitment Agency', 'agency', NULL);


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

-- SMS logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  contact_id uuid REFERENCES contacts(id),
  entity_type varchar(50),
  entity_id uuid,
  direction varchar(20) NOT NULL,
  phone_number varchar(50) NOT NULL,
  from_number varchar(50),
  to_number varchar(50),
  message_text text,
  provider varchar(50) DEFAULT 'ringcentral',
  rc_message_id varchar(255),
  status varchar(50) DEFAULT 'sent',
  created_at timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);



-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_logs_entity ON call_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_org_date ON call_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_provider ON call_logs(provider);
CREATE INDEX IF NOT EXISTS idx_call_logs_rc_session ON call_logs(rc_session_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_org ON sms_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_logs_phone ON sms_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_entity ON sms_logs(entity_type, entity_id);

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

-- Create project_shares table for sharing projects with external clients
CREATE TABLE IF NOT EXISTS project_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    share_token VARCHAR(255) NOT NULL UNIQUE,
    client_name VARCHAR(255),
    client_email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_project_shares_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_project_shares_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_token ON project_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_project_shares_org_id ON project_shares(org_id);

-- Add comment
COMMENT ON TABLE project_shares IS 'Stores shareable links for projects to share with external clients';



-- 5. Auto-cleanup Trigger
CREATE OR REPLACE FUNCTION prune_old_notifications() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM notifications
  WHERE target_user_id = NEW.target_user_id
    AND id NOT IN (
      SELECT id FROM notifications
      WHERE target_user_id = NEW.target_user_id
      ORDER BY created_at DESC
      LIMIT 200
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prune_notifications ON notifications;
CREATE TRIGGER trg_prune_notifications
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION prune_old_notifications();


 CREATE TABLE IF NOT EXISTS push_subscriptions (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      org_id uuid NOT NULL,
      endpoint text NOT NULL UNIQUE,
      p256dh text NOT NULL,
      auth text NOT NULL,
      created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
    )

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id)

-- =====================================================
-- END OF ADVANCED RECRUITMENT FEATURES
-- =====================================================

--
-- PostgreSQL database dump
--

\restrict 6nAeLpWtRPQc2gVIjb1HB4J8nR28v4eXgw2Pb1PtmBToqw9vYXRrVUdAFniLluf

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: add_creator_as_owner(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.add_creator_as_owner() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO workgroup_members (workgroup_id, user_id, role, joined_at)
    VALUES (NEW.id, NEW.created_by, 'owner', CURRENT_TIMESTAMP);
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.add_creator_as_owner() OWNER TO postgres;

--
-- Name: create_default_channel(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_default_channel() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO workgroup_channels (workgroup_id, name, description, type, is_general, created_by)
    VALUES (NEW.id, 'General', 'General discussion for the team', 'standard', true, NEW.created_by);
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.create_default_channel() OWNER TO postgres;

--
-- Name: log_stock_movement(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_stock_movement() RETURNS trigger
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


ALTER FUNCTION public.log_stock_movement() OWNER TO postgres;

--
-- Name: update_leave_remaining_days(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_leave_remaining_days() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.remaining_days = NEW.total_days - NEW.used_days;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_leave_remaining_days() OWNER TO postgres;

--
-- Name: update_stock_available_quantity(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_stock_available_quantity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.available_quantity = NEW.quantity - NEW.reserved_quantity;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_stock_available_quantity() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- Name: update_workgroup_member_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_workgroup_member_count() RETURNS trigger
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


ALTER FUNCTION public.update_workgroup_member_count() OWNER TO postgres;

--
-- Name: update_workgroup_message_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_workgroup_message_count() RETURNS trigger
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


ALTER FUNCTION public.update_workgroup_message_count() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.activities OWNER TO postgres;

--
-- Name: attendance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.attendance OWNER TO postgres;

--
-- Name: calendar_event_attendees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calendar_event_attendees (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id uuid,
    user_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    email text,
    is_organizer boolean DEFAULT false,
    org_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.calendar_event_attendees OWNER TO postgres;

--
-- Name: calendar_connections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calendar_connections (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
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


ALTER TABLE public.calendar_connections OWNER TO postgres;

--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calendar_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.calendar_events OWNER TO postgres;

--
-- Name: call_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.call_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.call_logs OWNER TO postgres;

--
-- Name: companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.companies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.companies OWNER TO postgres;

--
-- Name: connected_drives; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.connected_drives (
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


ALTER TABLE public.connected_drives OWNER TO postgres;

--
-- Name: connected_mailboxes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.connected_mailboxes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.connected_mailboxes OWNER TO postgres;

--
-- Name: contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contacts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.contacts OWNER TO postgres;

--
-- Name: crm_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crm_activities (
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


ALTER TABLE public.crm_activities OWNER TO postgres;

--
-- Name: crm_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crm_comments (
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

ALTER TABLE public.crm_comments OWNER TO postgres;

--
-- Name: crm_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crm_documents (
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

ALTER TABLE public.crm_documents OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: deal_contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deal_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    deal_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    role character varying(100),
    primary_contact boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.deal_contacts OWNER TO postgres;

--
-- Name: deal_signing_parties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deal_signing_parties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    deal_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    role character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.deal_signing_parties OWNER TO postgres;

--
-- Name: deals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    title character varying(255) NOT NULL,
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
    tags text[]
);


ALTER TABLE public.deals OWNER TO postgres;

--
-- Name: COLUMN deals.description; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deals.description IS 'Detailed description of the deal';


--
-- Name: COLUMN deals.source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deals.source IS 'Lead source: website, referral, linkedin, etc.';


--
-- Name: COLUMN deals.contact_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deals.contact_name IS 'Name of the primary contact person';


--
-- Name: COLUMN deals.company_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deals.company_name IS 'Name of the company';


--
-- Name: COLUMN deals.phone; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deals.phone IS 'Contact phone number';


--
-- Name: COLUMN deals.email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deals.email IS 'Contact email address';


--
-- Name: COLUMN deals.priority; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deals.priority IS 'Deal priority: low, medium, high, urgent';


--
-- Name: drive_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_activities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid,
    user_id uuid,
    file_id uuid,
    folder_id uuid,
    activity_type character varying(50) NOT NULL,
    activity_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.drive_activities OWNER TO postgres;

--
-- Name: drive_file_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_file_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    file_id uuid,
    version_number integer NOT NULL,
    file_path character varying(1000),
    file_size bigint,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.drive_file_versions OWNER TO postgres;

--
-- Name: drive_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_files (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.drive_files OWNER TO postgres;

--
-- Name: drive_folders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_folders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.drive_folders OWNER TO postgres;

--
-- Name: drive_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    drive_id uuid,
    org_id uuid,
    user_id uuid,
    role uuid,
    access_level character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.drive_permissions OWNER TO postgres;

--
-- Name: emails; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.emails (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_mailbox_id_fkey FOREIGN KEY (mailbox_id) REFERENCES public.connected_mailboxes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_message_id_key UNIQUE (message_id);

CREATE INDEX idx_emails_mailbox_id ON public.emails USING btree (mailbox_id);




ALTER TABLE public.emails OWNER TO postgres;

--
-- Name: employee_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_documents (
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


ALTER TABLE public.employee_documents OWNER TO postgres;

--
-- Name: TABLE employee_documents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.employee_documents IS 'Stores employee document uploads';


--
-- Name: employee_leave_balances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_leave_balances (
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


ALTER TABLE public.employee_leave_balances OWNER TO postgres;

--
-- Name: TABLE employee_leave_balances; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.employee_leave_balances IS 'Employee leave balance tracking per year';


--
-- Name: employee_product_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_product_assignments (
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


ALTER TABLE public.employee_product_assignments OWNER TO postgres;

--
-- Name: employee_salaries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_salaries (
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


ALTER TABLE public.employee_salaries OWNER TO postgres;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: entity_drive_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_drive_files (
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


ALTER TABLE public.entity_drive_files OWNER TO postgres;

--
-- Name: hrms_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hrms_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.hrms_notifications OWNER TO postgres;

--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.invoice_items OWNER TO postgres;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: lead_external_sources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_external_sources (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.lead_external_sources OWNER TO postgres;

--
-- Name: lead_imports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_imports (
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


ALTER TABLE public.lead_imports OWNER TO postgres;

--
-- Name: lead_workspace_access; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_workspace_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    granted_by uuid,
    access_level character varying(50) DEFAULT 'view'::character varying,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.lead_workspace_access OWNER TO postgres;

--
-- Name: lead_workspaces; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_workspaces (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.lead_workspaces OWNER TO postgres;

--
-- Name: leads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leads (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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
    is_converted boolean DEFAULT false
);


ALTER TABLE public.leads OWNER TO postgres;

--
-- Name: leave_balances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_balances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    leave_type_id uuid,
    year integer NOT NULL,
    total_days numeric(5,2) DEFAULT 0,
    used_days numeric(5,2) DEFAULT 0,
    remaining_days numeric(5,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.leave_balances OWNER TO postgres;

--
-- Name: leave_request_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_request_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    leave_request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    comment text NOT NULL,
    action character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.leave_request_comments OWNER TO postgres;

--
-- Name: TABLE leave_request_comments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.leave_request_comments IS 'Comments and history for leave requests';


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_requests (
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


ALTER TABLE public.leave_requests OWNER TO postgres;

--
-- Name: TABLE leave_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.leave_requests IS 'Leave requests with approval workflow';


--
-- Name: leave_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_types (
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


ALTER TABLE public.leave_types OWNER TO postgres;

--
-- Name: TABLE leave_types; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.leave_types IS 'Leave type definitions with policies and rules';


--
-- Name: marketing_ab_test_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_ab_test_results (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    test_id uuid,
    variant_id uuid,
    contact_id uuid,
    opened boolean DEFAULT false,
    clicked boolean DEFAULT false,
    converted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_ab_test_results OWNER TO postgres;

--
-- Name: marketing_ab_test_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_ab_test_variants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.marketing_ab_test_variants OWNER TO postgres;

--
-- Name: marketing_ab_tests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_ab_tests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.marketing_ab_tests OWNER TO postgres;

--
-- Name: marketing_campaign_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_campaign_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.marketing_campaign_events OWNER TO postgres;

--
-- Name: marketing_campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_campaigns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.marketing_campaigns OWNER TO postgres;

--
-- Name: marketing_form_submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_form_submissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    form_id uuid,
    contact_id uuid,
    data jsonb NOT NULL,
    ip_address character varying(45),
    user_agent text,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_form_submissions OWNER TO postgres;

--
-- Name: marketing_forms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_forms (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.marketing_forms OWNER TO postgres;

--
-- Name: marketing_list_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_list_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.marketing_list_members OWNER TO postgres;

--
-- Name: marketing_lists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_lists (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.marketing_lists OWNER TO postgres;

--
-- Name: marketing_scoring_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_scoring_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    contact_id uuid,
    rule_id uuid,
    score_change integer NOT NULL,
    reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_scoring_history OWNER TO postgres;

--
-- Name: marketing_scoring_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_scoring_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.marketing_scoring_rules OWNER TO postgres;

--
-- Name: marketing_segments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_segments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.marketing_segments OWNER TO postgres;

--
-- Name: marketing_sequence_enrollments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_sequence_enrollments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sequence_id uuid,
    contact_id uuid,
    current_step integer DEFAULT 0,
    status character varying(50) DEFAULT 'active'::character varying,
    enrolled_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_sequence_enrollments OWNER TO postgres;

--
-- Name: marketing_sequence_steps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_sequence_steps (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.marketing_sequence_steps OWNER TO postgres;

--
-- Name: marketing_sequences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_sequences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.marketing_sequences OWNER TO postgres;

--
-- Name: marketing_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.marketing_templates OWNER TO postgres;

--
-- Name: marketing_webhook_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_webhook_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.marketing_webhook_logs OWNER TO postgres;

--
-- Name: marketing_webhook_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_webhook_queue (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    webhook_id uuid,
    event_type character varying(50) NOT NULL,
    payload jsonb NOT NULL,
    attempts integer DEFAULT 0,
    next_retry_at timestamp without time zone,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_webhook_queue OWNER TO postgres;

--
-- Name: marketing_webhooks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_webhooks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.marketing_webhooks OWNER TO postgres;

--
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.notification_templates OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    user_id uuid,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    link character varying(500),
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    domain character varying(255),
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: payroll; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payroll (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.payroll OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    resource character varying(100) NOT NULL,
    action character varying(50) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: pipeline_stages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pipeline_stages (
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


ALTER TABLE public.pipeline_stages OWNER TO postgres;

--
-- Name: product_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_batches (
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


ALTER TABLE public.product_batches OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: project_activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_activity_logs (
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


ALTER TABLE public.project_activity_logs OWNER TO postgres;

--
-- Name: project_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_attachments (
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


ALTER TABLE public.project_attachments OWNER TO postgres;

--
-- Name: project_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_comments (
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


ALTER TABLE public.project_comments OWNER TO postgres;

--
-- Name: project_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.project_documents OWNER TO postgres;

--
-- Name: project_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying,
    permissions jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.project_members OWNER TO postgres;

--
-- Name: project_milestones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_milestones (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.project_milestones OWNER TO postgres;

--
-- Name: project_risks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_risks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.project_risks OWNER TO postgres;

--
-- Name: project_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.project_tasks OWNER TO postgres;

--
-- Name: project_time_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_time_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.project_time_entries OWNER TO postgres;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: public_holidays; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.public_holidays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    date date NOT NULL,
    is_optional boolean DEFAULT false,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.public_holidays OWNER TO postgres;

--
-- Name: TABLE public_holidays; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.public_holidays IS 'Organization public holidays';


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.purchase_order_items OWNER TO postgres;

--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.purchase_orders OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(100) NOT NULL,
    description text,
    permissions jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: salary_components; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salary_components (
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


ALTER TABLE public.salary_components OWNER TO postgres;

--
-- Name: salary_slip_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salary_slip_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salary_slip_id uuid NOT NULL,
    component_name character varying(255) NOT NULL,
    component_type character varying(50) NOT NULL,
    amount numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.salary_slip_items OWNER TO postgres;

--
-- Name: salary_slips; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salary_slips (
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


ALTER TABLE public.salary_slips OWNER TO postgres;

--
-- Name: signing_parties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.signing_parties (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.signing_parties OWNER TO postgres;

--
-- Name: stock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.stock OWNER TO postgres;

--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_adjustments (
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


ALTER TABLE public.stock_adjustments OWNER TO postgres;

--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.stock_movements OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
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


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: unibox_emails; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.unibox_emails (
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


ALTER TABLE public.unibox_emails OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    id uuid DEFAULT public.uuid_generate_v4(),
    role character varying(50) DEFAULT 'user'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying,
    is_active boolean DEFAULT true,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    avatar_url character varying(500),
    phone character varying(50),
    "position" character varying(100),
    org_id uuid,
    department character varying(100),
    bio text,
    timezone character varying(100),
    language character varying(10) DEFAULT 'en'::character varying
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: vendors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.vendors OWNER TO postgres;

--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.warehouses OWNER TO postgres;

--
-- Name: workflow_actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workflow_actions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.workflow_actions OWNER TO postgres;

--
-- Name: workflow_execution_steps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workflow_execution_steps (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    execution_id uuid,
    action_id uuid,
    status character varying(50) DEFAULT 'running'::character varying,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.workflow_execution_steps OWNER TO postgres;

--
-- Name: workflow_executions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workflow_executions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.workflow_executions OWNER TO postgres;

--
-- Name: workflows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workflows (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
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


ALTER TABLE public.workflows OWNER TO postgres;

--
-- Name: workgroup_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workgroup_id uuid NOT NULL,
    user_id uuid,
    activity_type character varying(100) NOT NULL,
    activity_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.workgroup_activities OWNER TO postgres;

--
-- Name: TABLE workgroup_activities; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workgroup_activities IS 'Activity log for workgroups for audit and notifications';


--
-- Name: workgroup_channels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_channels (
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


ALTER TABLE public.workgroup_channels OWNER TO postgres;

--
-- Name: TABLE workgroup_channels; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workgroup_channels IS 'Channels within workgroups for organized discussions';


--
-- Name: workgroup_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_files (
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


ALTER TABLE public.workgroup_files OWNER TO postgres;

--
-- Name: TABLE workgroup_files; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workgroup_files IS 'Files shared within workgroups and channels';


--
-- Name: workgroup_meeting_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_meeting_participants (
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


ALTER TABLE public.workgroup_meeting_participants OWNER TO postgres;

--
-- Name: workgroup_meetings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_meetings (
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


ALTER TABLE public.workgroup_meetings OWNER TO postgres;

--
-- Name: TABLE workgroup_meetings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workgroup_meetings IS 'Scheduled and active meetings within workgroups';


--
-- Name: workgroup_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_members (
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


ALTER TABLE public.workgroup_members OWNER TO postgres;

--
-- Name: TABLE workgroup_members; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workgroup_members IS 'Members of workgroups with roles and permissions';


--
-- Name: workgroup_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    workgroup_id uuid,
    user_id uuid,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.workgroup_notifications OWNER TO postgres;

--
-- Name: workgroup_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_posts (
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
    reactions jsonb DEFAULT '{}'::jsonb,
    mention_users uuid[] DEFAULT '{}'::uuid[],
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT workgroup_posts_content_type_check CHECK (((content_type)::text = ANY (ARRAY[('text'::character varying)::text, ('file'::character varying)::text, ('image'::character varying)::text, ('link'::character varying)::text, ('code'::character varying)::text])))
);


ALTER TABLE public.workgroup_posts OWNER TO postgres;

--
-- Name: TABLE workgroup_posts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workgroup_posts IS 'Messages/posts within workgroups and channels';


--
-- Name: workgroups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroups (
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


ALTER TABLE public.workgroups OWNER TO postgres;

--
-- Name: TABLE workgroups; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workgroups IS 'Microsoft Teams-style workgroups/teams for collaboration';


--
-- Name: workgroup_stats; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.workgroup_stats AS
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
   FROM ((public.workgroups w
     LEFT JOIN public.workgroup_members wm ON ((w.id = wm.workgroup_id)))
     LEFT JOIN public.workgroup_posts wp ON ((w.id = wp.workgroup_id)))
  GROUP BY w.id, w.name, w.type, w.is_private, w.member_count, w.message_count, w.last_activity_at;


ALTER VIEW public.workgroup_stats OWNER TO postgres;

--
-- Name: workgroup_wiki; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_wiki (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    workgroup_id uuid,
    title character varying(255) NOT NULL,
    content text,
    parent_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.workgroup_wiki OWNER TO postgres;

--
-- Name: workgroup_wiki_pages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_wiki_pages (
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


ALTER TABLE public.workgroup_wiki_pages OWNER TO postgres;

--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_employee_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_date_key UNIQUE (employee_id, date);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: calendar_event_attendees calendar_event_attendees_event_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_event_id_user_id_key UNIQUE (event_id, user_id);


--
-- Name: calendar_event_attendees calendar_event_attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: call_logs call_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: connected_drives connected_drives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connected_drives
    ADD CONSTRAINT connected_drives_pkey PRIMARY KEY (id);


--
-- Name: connected_mailboxes connected_mailboxes_org_id_user_id_email_address_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connected_mailboxes
    ADD CONSTRAINT connected_mailboxes_org_id_user_id_email_address_key UNIQUE (org_id, user_id, email_address);


--
-- Name: connected_mailboxes connected_mailboxes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connected_mailboxes
    ADD CONSTRAINT connected_mailboxes_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: crm_activities crm_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_pkey PRIMARY KEY (id);


--
-- Name: crm_comments crm_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_comments
    ADD CONSTRAINT crm_comments_pkey PRIMARY KEY (id);


--
-- Name: crm_documents crm_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_documents
    ADD CONSTRAINT crm_documents_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: deal_contacts deal_contacts_org_id_deal_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_contacts
    ADD CONSTRAINT deal_contacts_org_id_deal_id_contact_id_key UNIQUE (org_id, deal_id, contact_id);


--
-- Name: deal_contacts deal_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_contacts
    ADD CONSTRAINT deal_contacts_pkey PRIMARY KEY (id);


--
-- Name: deal_signing_parties deal_signing_parties_org_id_deal_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_signing_parties
    ADD CONSTRAINT deal_signing_parties_org_id_deal_id_contact_id_key UNIQUE (org_id, deal_id, contact_id);


--
-- Name: deal_signing_parties deal_signing_parties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_signing_parties
    ADD CONSTRAINT deal_signing_parties_pkey PRIMARY KEY (id);


--
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- Name: drive_activities drive_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_activities
    ADD CONSTRAINT drive_activities_pkey PRIMARY KEY (id);


--
-- Name: drive_file_versions drive_file_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_file_versions
    ADD CONSTRAINT drive_file_versions_pkey PRIMARY KEY (id);


--
-- Name: drive_files drive_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_files
    ADD CONSTRAINT drive_files_pkey PRIMARY KEY (id);


--
-- Name: drive_folders drive_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_folders
    ADD CONSTRAINT drive_folders_pkey PRIMARY KEY (id);


--
-- Name: drive_permissions drive_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_permissions
    ADD CONSTRAINT drive_permissions_pkey PRIMARY KEY (id);


--
-- Name: emails emails_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_pkey PRIMARY KEY (id);


--
-- Name: employee_documents employee_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_leave_type_id_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_leave_type_id_year_key UNIQUE (employee_id, leave_type_id, year);


--
-- Name: employee_leave_balances employee_leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_pkey PRIMARY KEY (id);


--
-- Name: employee_product_assignments employee_product_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_product_assignments
    ADD CONSTRAINT employee_product_assignments_pkey PRIMARY KEY (id);


--
-- Name: employee_salaries employee_salaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_salaries
    ADD CONSTRAINT employee_salaries_pkey PRIMARY KEY (id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_code_key UNIQUE (employee_code);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: entity_drive_files entity_drive_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_drive_files
    ADD CONSTRAINT entity_drive_files_pkey PRIMARY KEY (id);


--
-- Name: hrms_notifications hrms_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hrms_notifications
    ADD CONSTRAINT hrms_notifications_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: lead_external_sources lead_external_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_external_sources
    ADD CONSTRAINT lead_external_sources_pkey PRIMARY KEY (id);


--
-- Name: lead_imports lead_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_imports
    ADD CONSTRAINT lead_imports_pkey PRIMARY KEY (id);


--
-- Name: lead_workspace_access lead_workspace_access_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspace_access
    ADD CONSTRAINT lead_workspace_access_pkey PRIMARY KEY (id);


--
-- Name: lead_workspaces lead_workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspaces
    ADD CONSTRAINT lead_workspaces_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: leave_balances leave_balances_employee_id_leave_type_id_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_employee_id_leave_type_id_year_key UNIQUE (employee_id, leave_type_id, year);


--
-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);


--
-- Name: leave_request_comments leave_request_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_request_comments
    ADD CONSTRAINT leave_request_comments_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- Name: marketing_ab_test_results marketing_ab_test_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_test_results
    ADD CONSTRAINT marketing_ab_test_results_pkey PRIMARY KEY (id);


--
-- Name: marketing_ab_test_variants marketing_ab_test_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_test_variants
    ADD CONSTRAINT marketing_ab_test_variants_pkey PRIMARY KEY (id);


--
-- Name: marketing_ab_tests marketing_ab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_tests
    ADD CONSTRAINT marketing_ab_tests_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaign_events marketing_campaign_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_events
    ADD CONSTRAINT marketing_campaign_events_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaigns marketing_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_pkey PRIMARY KEY (id);


--
-- Name: marketing_form_submissions marketing_form_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_form_submissions
    ADD CONSTRAINT marketing_form_submissions_pkey PRIMARY KEY (id);


--
-- Name: marketing_forms marketing_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_forms
    ADD CONSTRAINT marketing_forms_pkey PRIMARY KEY (id);


--
-- Name: marketing_list_members marketing_list_members_list_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_list_members
    ADD CONSTRAINT marketing_list_members_list_id_contact_id_key UNIQUE (list_id, contact_id);


--
-- Name: marketing_list_members marketing_list_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_list_members
    ADD CONSTRAINT marketing_list_members_pkey PRIMARY KEY (id);


--
-- Name: marketing_lists marketing_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_lists
    ADD CONSTRAINT marketing_lists_pkey PRIMARY KEY (id);


--
-- Name: marketing_scoring_history marketing_scoring_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_scoring_history
    ADD CONSTRAINT marketing_scoring_history_pkey PRIMARY KEY (id);


--
-- Name: marketing_scoring_rules marketing_scoring_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_scoring_rules
    ADD CONSTRAINT marketing_scoring_rules_pkey PRIMARY KEY (id);


--
-- Name: marketing_segments marketing_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_segments
    ADD CONSTRAINT marketing_segments_pkey PRIMARY KEY (id);


--
-- Name: marketing_sequence_enrollments marketing_sequence_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequence_enrollments
    ADD CONSTRAINT marketing_sequence_enrollments_pkey PRIMARY KEY (id);


--
-- Name: marketing_sequence_enrollments marketing_sequence_enrollments_sequence_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequence_enrollments
    ADD CONSTRAINT marketing_sequence_enrollments_sequence_id_contact_id_key UNIQUE (sequence_id, contact_id);


--
-- Name: marketing_sequence_steps marketing_sequence_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequence_steps
    ADD CONSTRAINT marketing_sequence_steps_pkey PRIMARY KEY (id);


--
-- Name: marketing_sequences marketing_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequences
    ADD CONSTRAINT marketing_sequences_pkey PRIMARY KEY (id);


--
-- Name: marketing_templates marketing_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_templates
    ADD CONSTRAINT marketing_templates_pkey PRIMARY KEY (id);


--
-- Name: marketing_webhook_logs marketing_webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhook_logs
    ADD CONSTRAINT marketing_webhook_logs_pkey PRIMARY KEY (id);


--
-- Name: marketing_webhook_queue marketing_webhook_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhook_queue
    ADD CONSTRAINT marketing_webhook_queue_pkey PRIMARY KEY (id);


--
-- Name: marketing_webhooks marketing_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhooks
    ADD CONSTRAINT marketing_webhooks_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: payroll payroll_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: pipeline_stages pipeline_stages_org_id_pipeline_stage_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_org_id_pipeline_stage_key_key UNIQUE (org_id, pipeline, stage_key);


--
-- Name: pipeline_stages pipeline_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_pkey PRIMARY KEY (id);


--
-- Name: product_batches product_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_activity_logs project_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_activity_logs
    ADD CONSTRAINT project_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: project_attachments project_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_attachments
    ADD CONSTRAINT project_attachments_pkey PRIMARY KEY (id);


--
-- Name: project_comments project_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_comments
    ADD CONSTRAINT project_comments_pkey PRIMARY KEY (id);


--
-- Name: project_documents project_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT project_documents_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: project_milestones project_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_pkey PRIMARY KEY (id);


--
-- Name: project_risks project_risks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_risks
    ADD CONSTRAINT project_risks_pkey PRIMARY KEY (id);


--
-- Name: project_tasks project_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_pkey PRIMARY KEY (id);


--
-- Name: project_time_entries project_time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_time_entries
    ADD CONSTRAINT project_time_entries_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: public_holidays public_holidays_org_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_holidays
    ADD CONSTRAINT public_holidays_org_id_date_key UNIQUE (org_id, date);


--
-- Name: public_holidays public_holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_holidays
    ADD CONSTRAINT public_holidays_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: salary_components salary_components_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_components
    ADD CONSTRAINT salary_components_pkey PRIMARY KEY (id);


--
-- Name: salary_slip_items salary_slip_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_slip_items
    ADD CONSTRAINT salary_slip_items_pkey PRIMARY KEY (id);


--
-- Name: salary_slips salary_slips_org_id_employee_id_month_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_slips
    ADD CONSTRAINT salary_slips_org_id_employee_id_month_year_key UNIQUE (org_id, employee_id, month, year);


--
-- Name: salary_slips salary_slips_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_slips
    ADD CONSTRAINT salary_slips_pkey PRIMARY KEY (id);


--
-- Name: signing_parties signing_parties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signing_parties
    ADD CONSTRAINT signing_parties_pkey PRIMARY KEY (id);


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock stock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_pkey PRIMARY KEY (id);


--
-- Name: stock stock_product_id_warehouse_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_product_id_warehouse_id_key UNIQUE (product_id, warehouse_id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: unibox_emails unibox_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unibox_emails
    ADD CONSTRAINT unibox_emails_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_code_key UNIQUE (code);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: workflow_actions workflow_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_actions
    ADD CONSTRAINT workflow_actions_pkey PRIMARY KEY (id);


--
-- Name: workflow_execution_steps workflow_execution_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_execution_steps
    ADD CONSTRAINT workflow_execution_steps_pkey PRIMARY KEY (id);


--
-- Name: workflow_executions workflow_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_executions
    ADD CONSTRAINT workflow_executions_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: workgroup_activities workgroup_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_activities
    ADD CONSTRAINT workgroup_activities_pkey PRIMARY KEY (id);


--
-- Name: workgroup_channels workgroup_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_channels
    ADD CONSTRAINT workgroup_channels_pkey PRIMARY KEY (id);


--
-- Name: workgroup_channels workgroup_channels_workgroup_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_channels
    ADD CONSTRAINT workgroup_channels_workgroup_id_name_key UNIQUE (workgroup_id, name);


--
-- Name: workgroup_files workgroup_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_files
    ADD CONSTRAINT workgroup_files_pkey PRIMARY KEY (id);


--
-- Name: workgroup_meeting_participants workgroup_meeting_participants_meeting_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meeting_participants
    ADD CONSTRAINT workgroup_meeting_participants_meeting_id_user_id_key UNIQUE (meeting_id, user_id);


--
-- Name: workgroup_meeting_participants workgroup_meeting_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meeting_participants
    ADD CONSTRAINT workgroup_meeting_participants_pkey PRIMARY KEY (id);


--
-- Name: workgroup_meetings workgroup_meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meetings
    ADD CONSTRAINT workgroup_meetings_pkey PRIMARY KEY (id);


--
-- Name: workgroup_members workgroup_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_members
    ADD CONSTRAINT workgroup_members_pkey PRIMARY KEY (id);


--
-- Name: workgroup_members workgroup_members_workgroup_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_members
    ADD CONSTRAINT workgroup_members_workgroup_id_user_id_key UNIQUE (workgroup_id, user_id);


--
-- Name: workgroup_notifications workgroup_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_notifications
    ADD CONSTRAINT workgroup_notifications_pkey PRIMARY KEY (id);


--
-- Name: workgroup_posts workgroup_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_posts
    ADD CONSTRAINT workgroup_posts_pkey PRIMARY KEY (id);


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_pkey PRIMARY KEY (id);


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_workgroup_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_workgroup_id_slug_key UNIQUE (workgroup_id, slug);


--
-- Name: workgroup_wiki workgroup_wiki_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki
    ADD CONSTRAINT workgroup_wiki_pkey PRIMARY KEY (id);


--
-- Name: workgroups workgroups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroups
    ADD CONSTRAINT workgroups_pkey PRIMARY KEY (id);


--
--
-- Name: idx_crm_comments_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_comments_entity ON public.crm_comments USING btree (entity_type, entity_id);

--
-- Name: idx_crm_comments_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_comments_org ON public.crm_comments USING btree (org_id);

--
-- Name: idx_crm_documents_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_documents_entity ON public.crm_documents USING btree (entity_type, entity_id);

--
-- Name: idx_crm_documents_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_documents_org ON public.crm_documents USING btree (org_id);

-- Name: idx_activities_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activities_contact ON public.activities USING btree (contact_id);


--
-- Name: idx_activities_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activities_organization ON public.activities USING btree (organization_id);


--
-- Name: idx_attendance_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_employee ON public.attendance USING btree (employee_id);


--
-- Name: idx_companies_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_companies_organization ON public.companies USING btree (organization_id);


--
-- Name: idx_connected_drives_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_connected_drives_org ON public.connected_drives USING btree (org_id);


--
-- Name: idx_contacts_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_email ON public.contacts USING btree (email);


--
-- Name: idx_contacts_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_organization ON public.contacts USING btree (organization_id);


--
-- Name: idx_customers_converted_deal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_converted_deal ON public.customers USING btree (converted_from_deal_id);


--
-- Name: idx_customers_converted_lead; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_converted_lead ON public.customers USING btree (converted_from_lead_id);


--
-- Name: idx_deal_contacts_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deal_contacts_contact ON public.deal_contacts USING btree (contact_id);


--
-- Name: idx_deal_contacts_deal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deal_contacts_deal ON public.deal_contacts USING btree (deal_id);


--
-- Name: idx_deal_contacts_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deal_contacts_org ON public.deal_contacts USING btree (org_id);


--
-- Name: idx_deal_signing_parties_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deal_signing_parties_contact ON public.deal_signing_parties USING btree (contact_id);


--
-- Name: idx_deal_signing_parties_deal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deal_signing_parties_deal ON public.deal_signing_parties USING btree (deal_id);


--
-- Name: idx_deal_signing_parties_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deal_signing_parties_org ON public.deal_signing_parties USING btree (org_id);


--
-- Name: idx_deals_agent_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_agent_name ON public.deals USING btree (agent_name);


--
-- Name: idx_deals_company_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_company_name ON public.deals USING btree (company_name);


--
-- Name: idx_deals_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_contact ON public.deals USING btree (contact_id);


--
-- Name: idx_deals_contact_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_contact_name ON public.deals USING btree (contact_name);


--
-- Name: idx_deals_converted_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_converted_customer ON public.deals USING btree (converted_to_customer_id);


--
-- Name: idx_deals_converted_lead; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_converted_lead ON public.deals USING btree (converted_from_lead_id);


--
-- Name: idx_deals_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_email ON public.deals USING btree (email);


--
-- Name: idx_deals_external_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_external_source ON public.deals USING btree (external_source_id);


--
-- Name: idx_deals_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_organization ON public.deals USING btree (organization_id);


--
-- Name: idx_deals_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_priority ON public.deals USING btree (priority);


--
-- Name: idx_deals_service_interested; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_service_interested ON public.deals USING btree (service_interested);


--
-- Name: idx_deals_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_source ON public.deals USING btree (source);


--
-- Name: idx_deals_workspace_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_workspace_id ON public.deals USING btree (workspace_id);


--
-- Name: idx_drive_permissions_drive; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drive_permissions_drive ON public.drive_permissions USING btree (drive_id);


--
-- Name: idx_employee_documents_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_documents_employee ON public.employee_documents USING btree (employee_id);


--
-- Name: idx_employee_documents_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_documents_org ON public.employee_documents USING btree (org_id);


--
-- Name: idx_employee_documents_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_documents_type ON public.employee_documents USING btree (document_type);


--
-- Name: idx_employee_salaries_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_salaries_employee ON public.employee_salaries USING btree (employee_id);


--
-- Name: idx_employees_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_organization ON public.employees USING btree (organization_id);


--
-- Name: idx_entity_drive_files_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_drive_files_entity ON public.entity_drive_files USING btree (entity_type, entity_id);


--
-- Name: idx_epa_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_epa_employee_id ON public.employee_product_assignments USING btree (employee_id);


--
-- Name: idx_epa_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_epa_org_id ON public.employee_product_assignments USING btree (org_id);


--
-- Name: idx_epa_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_epa_product_id ON public.employee_product_assignments USING btree (product_id);


--
-- Name: idx_epa_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_epa_status ON public.employee_product_assignments USING btree (status);


--
-- Name: idx_holidays_org_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_holidays_org_date ON public.public_holidays USING btree (org_id, date);


--
-- Name: idx_lead_imports_imported_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_imports_imported_by ON public.lead_imports USING btree (imported_by);


--
-- Name: idx_lead_imports_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_imports_org_id ON public.lead_imports USING btree (org_id);


--
-- Name: idx_lead_imports_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_imports_status ON public.lead_imports USING btree (status);


--
-- Name: idx_lead_imports_workspace_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_imports_workspace_id ON public.lead_imports USING btree (workspace_id);


--
-- Name: idx_leads_assigned_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_assigned_to ON public.leads USING btree (assigned_to);


--
-- Name: idx_leads_converted_deal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_converted_deal ON public.leads USING btree (converted_to_deal_id);


--
-- Name: idx_leads_converted_to_deal_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_converted_to_deal_id ON public.leads USING btree (converted_to_deal_id);


--
-- Name: idx_leads_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_created_by ON public.leads USING btree (created_by);


--
-- Name: idx_leads_import_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_import_id ON public.leads USING btree (import_id);


--
-- Name: idx_leads_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_organization ON public.leads USING btree (organization_id);


--
-- Name: idx_leads_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_workspace ON public.leads USING btree (workspace_id);


--
-- Name: idx_leads_workspace_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_workspace_id ON public.leads USING btree (workspace_id);


--
-- Name: idx_leave_balances_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_balances_employee ON public.employee_leave_balances USING btree (employee_id);


--
-- Name: idx_leave_balances_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_balances_org ON public.employee_leave_balances USING btree (org_id);


--
-- Name: idx_leave_balances_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_balances_year ON public.employee_leave_balances USING btree (year);


--
-- Name: idx_leave_comments_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_comments_request ON public.leave_request_comments USING btree (leave_request_id);


--
-- Name: idx_leave_requests_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_requests_dates ON public.leave_requests USING btree (start_date, end_date);


--
-- Name: idx_leave_requests_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_requests_employee ON public.leave_requests USING btree (employee_id);


--
-- Name: idx_leave_requests_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_requests_org ON public.leave_requests USING btree (org_id);


--
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);


--
-- Name: idx_marketing_campaigns_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_campaigns_org ON public.marketing_campaigns USING btree (organization_id);


--
-- Name: idx_marketing_events_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_events_campaign ON public.marketing_campaign_events USING btree (campaign_id);


--
-- Name: idx_marketing_events_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_events_contact ON public.marketing_campaign_events USING btree (contact_id);


--
-- Name: idx_marketing_lists_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_lists_org ON public.marketing_lists USING btree (organization_id);


--
-- Name: idx_pipeline_stages_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pipeline_stages_org ON public.pipeline_stages USING btree (org_id);


--
-- Name: idx_product_batches_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_batches_org ON public.product_batches USING btree (org_id);


--
-- Name: idx_product_batches_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_batches_product ON public.product_batches USING btree (product_id);


--
-- Name: idx_products_barcode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_barcode ON public.products USING btree (barcode);


--
-- Name: idx_products_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_organization ON public.products USING btree (organization_id);


--
-- Name: idx_products_reorder_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_reorder_level ON public.products USING btree (reorder_level);


--
-- Name: idx_project_activity_logs_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_activity_logs_project ON public.project_activity_logs USING btree (project_id);


--
-- Name: idx_project_attachments_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_attachments_project ON public.project_attachments USING btree (project_id);


--
-- Name: idx_project_comments_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_comments_project ON public.project_comments USING btree (project_id);


--
-- Name: idx_project_comments_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_comments_task ON public.project_comments USING btree (task_id);


--
-- Name: idx_project_members_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_members_project ON public.project_members USING btree (project_id);


--
-- Name: idx_project_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_members_user ON public.project_members USING btree (user_id);


--
-- Name: idx_project_tasks_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_tasks_parent ON public.project_tasks USING btree (parent_task_id);


--
-- Name: idx_projects_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_organization ON public.projects USING btree (organization_id);


--
-- Name: idx_salary_components_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_salary_components_org ON public.salary_components USING btree (org_id);


--
-- Name: idx_salary_slips_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_salary_slips_employee ON public.salary_slips USING btree (employee_id);


--
-- Name: idx_salary_slips_month_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_salary_slips_month_year ON public.salary_slips USING btree (month, year);


--
-- Name: idx_stock_adjustments_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_adjustments_org ON public.stock_adjustments USING btree (org_id);


--
-- Name: idx_stock_adjustments_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_adjustments_product ON public.stock_adjustments USING btree (product_id);


--
-- Name: idx_stock_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_product ON public.stock USING btree (product_id);


--
-- Name: idx_tasks_milestone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_milestone ON public.tasks USING btree (milestone_id);


--
-- Name: idx_tasks_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_parent ON public.tasks USING btree (parent_task_id);


--
-- Name: idx_unibox_emails_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unibox_emails_org ON public.unibox_emails USING btree (org_id);


--
-- Name: idx_unibox_emails_sender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unibox_emails_sender ON public.unibox_emails USING btree (sender_email);


--
-- Name: idx_unibox_emails_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unibox_emails_status ON public.unibox_emails USING btree (status);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_organization ON public.users USING btree (organization_id);


--
-- Name: idx_vendors_business_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendors_business_type ON public.vendors USING btree (business_type);


--
-- Name: idx_workgroup_activities_workgroup_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_activities_workgroup_created ON public.workgroup_activities USING btree (workgroup_id, created_at DESC);


--
-- Name: idx_workgroup_channels_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_channels_type ON public.workgroup_channels USING btree (type);


--
-- Name: idx_workgroup_channels_workgroup_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_channels_workgroup_id ON public.workgroup_channels USING btree (workgroup_id);


--
-- Name: idx_workgroup_files_channel_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_files_channel_id ON public.workgroup_files USING btree (channel_id);


--
-- Name: idx_workgroup_files_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_files_created_at ON public.workgroup_files USING btree (created_at DESC);


--
-- Name: idx_workgroup_files_uploaded_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_files_uploaded_by ON public.workgroup_files USING btree (uploaded_by);


--
-- Name: idx_workgroup_files_workgroup_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_files_workgroup_id ON public.workgroup_files USING btree (workgroup_id);


--
-- Name: idx_workgroup_meetings_scheduled_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_meetings_scheduled_start ON public.workgroup_meetings USING btree (scheduled_start);


--
-- Name: idx_workgroup_meetings_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_meetings_status ON public.workgroup_meetings USING btree (status);


--
-- Name: idx_workgroup_meetings_workgroup_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_meetings_workgroup_id ON public.workgroup_meetings USING btree (workgroup_id);


--
-- Name: idx_workgroup_members_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_members_role ON public.workgroup_members USING btree (role);


--
-- Name: idx_workgroup_members_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_members_user_id ON public.workgroup_members USING btree (user_id);


--
-- Name: idx_workgroup_members_workgroup_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_members_workgroup_id ON public.workgroup_members USING btree (workgroup_id);


--
-- Name: idx_workgroup_notifications_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_notifications_created_at ON public.workgroup_notifications USING btree (created_at DESC);


--
-- Name: idx_workgroup_notifications_is_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_notifications_is_read ON public.workgroup_notifications USING btree (is_read);


--
-- Name: idx_workgroup_notifications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_notifications_user_id ON public.workgroup_notifications USING btree (user_id);


--
-- Name: idx_workgroup_notifications_workgroup_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_notifications_workgroup_id ON public.workgroup_notifications USING btree (workgroup_id);


--
-- Name: idx_workgroup_posts_channel_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_posts_channel_id ON public.workgroup_posts USING btree (channel_id);


--
-- Name: idx_workgroup_posts_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_posts_created_at ON public.workgroup_posts USING btree (created_at DESC);


--
-- Name: idx_workgroup_posts_parent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_posts_parent_id ON public.workgroup_posts USING btree (parent_id);


--
-- Name: idx_workgroup_posts_workgroup_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_posts_workgroup_id ON public.workgroup_posts USING btree (workgroup_id);


--
-- Name: idx_workgroup_wiki_pages_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_wiki_pages_slug ON public.workgroup_wiki_pages USING btree (workgroup_id, slug);


--
-- Name: idx_workgroup_wiki_pages_workgroup_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_wiki_pages_workgroup_id ON public.workgroup_wiki_pages USING btree (workgroup_id);


--
-- Name: idx_workgroups_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroups_created_at ON public.workgroups USING btree (created_at DESC);


--
-- Name: idx_workgroups_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroups_org_id ON public.workgroups USING btree (org_id);


--
-- Name: idx_workgroups_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroups_type ON public.workgroups USING btree (type);


--
-- Name: workgroups trigger_add_creator_as_owner; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_add_creator_as_owner AFTER INSERT ON public.workgroups FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_owner();


--
-- Name: workgroups trigger_create_default_channel; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_create_default_channel AFTER INSERT ON public.workgroups FOR EACH ROW EXECUTE FUNCTION public.create_default_channel();


--
-- Name: stock trigger_log_stock_movement; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_log_stock_movement AFTER UPDATE ON public.stock FOR EACH ROW EXECUTE FUNCTION public.log_stock_movement();


--
-- Name: leave_balances trigger_update_leave_balance; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_leave_balance BEFORE INSERT OR UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.update_leave_remaining_days();


--
-- Name: stock trigger_update_stock_available; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_stock_available BEFORE INSERT OR UPDATE ON public.stock FOR EACH ROW EXECUTE FUNCTION public.update_stock_available_quantity();


--
-- Name: workgroup_members trigger_update_workgroup_member_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_workgroup_member_count AFTER INSERT OR DELETE ON public.workgroup_members FOR EACH ROW EXECUTE FUNCTION public.update_workgroup_member_count();


--
-- Name: workgroup_posts trigger_update_workgroup_message_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_workgroup_message_count AFTER INSERT OR DELETE ON public.workgroup_posts FOR EACH ROW EXECUTE FUNCTION public.update_workgroup_message_count();


--
-- Name: activities update_activities_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: attendance update_attendance_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: calendar_events update_calendar_events_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: companies update_companies_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contacts update_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: deals update_deals_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: drive_files update_drive_files_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_drive_files_updated_at BEFORE UPDATE ON public.drive_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: employees update_employees_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: leads update_leads_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: marketing_campaigns update_marketing_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_marketing_campaigns_updated_at BEFORE UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: marketing_forms update_marketing_forms_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_marketing_forms_updated_at BEFORE UPDATE ON public.marketing_forms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: marketing_lists update_marketing_lists_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_marketing_lists_updated_at BEFORE UPDATE ON public.marketing_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: marketing_segments update_marketing_segments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_marketing_segments_updated_at BEFORE UPDATE ON public.marketing_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: marketing_sequences update_marketing_sequences_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_marketing_sequences_updated_at BEFORE UPDATE ON public.marketing_sequences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: marketing_templates update_marketing_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_marketing_templates_updated_at BEFORE UPDATE ON public.marketing_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_templates update_notification_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON public.notification_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payroll update_payroll_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_payroll_updated_at BEFORE UPDATE ON public.payroll FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_risks update_project_risks_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_project_risks_updated_at BEFORE UPDATE ON public.project_risks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_tasks update_project_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: purchase_orders update_purchase_orders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: roles update_roles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vendors update_vendors_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: warehouses update_warehouses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workflows update_workflows_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workgroup_wiki update_workgroup_wiki_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_workgroup_wiki_updated_at BEFORE UPDATE ON public.workgroup_wiki FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: activities activities_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: activities activities_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: activities activities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: activities activities_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id);


--
-- Name: activities activities_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: activities activities_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: activities activities_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: activities activities_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: attendance attendance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: attendance attendance_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: attendance attendance_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: calendar_event_attendees calendar_event_attendees_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON DELETE CASCADE;


--
-- Name: calendar_event_attendees calendar_event_attendees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: calendar_events calendar_events_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: call_logs call_logs_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: call_logs call_logs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: call_logs call_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: call_logs call_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: companies companies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: companies companies_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: companies companies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: companies companies_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: connected_drives connected_drives_connected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connected_drives
    ADD CONSTRAINT connected_drives_connected_by_fkey FOREIGN KEY (connected_by) REFERENCES public.users(id);


--
-- Name: connected_drives connected_drives_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connected_drives
    ADD CONSTRAINT connected_drives_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: connected_mailboxes connected_mailboxes_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connected_mailboxes
    ADD CONSTRAINT connected_mailboxes_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: connected_mailboxes connected_mailboxes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connected_mailboxes
    ADD CONSTRAINT connected_mailboxes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: contacts contacts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: contacts contacts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: contacts contacts_responsible_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES public.users(id);


--
-- Name: customers customers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: customers customers_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: customers customers_converted_from_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_converted_from_deal_id_fkey FOREIGN KEY (converted_from_deal_id) REFERENCES public.deals(id) ON DELETE SET NULL;


--
-- Name: customers customers_converted_from_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_converted_from_lead_id_fkey FOREIGN KEY (converted_from_lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: customers customers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: customers customers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: deal_contacts deal_contacts_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_contacts
    ADD CONSTRAINT deal_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: deal_contacts deal_contacts_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_contacts
    ADD CONSTRAINT deal_contacts_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;


--
-- Name: deal_contacts deal_contacts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_contacts
    ADD CONSTRAINT deal_contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: deal_signing_parties deal_signing_parties_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_signing_parties
    ADD CONSTRAINT deal_signing_parties_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: deal_signing_parties deal_signing_parties_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_signing_parties
    ADD CONSTRAINT deal_signing_parties_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;


--
-- Name: deal_signing_parties deal_signing_parties_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_signing_parties
    ADD CONSTRAINT deal_signing_parties_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: deals deals_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: deals deals_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: deals deals_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: deals deals_converted_from_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_converted_from_lead_id_fkey FOREIGN KEY (converted_from_lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: deals deals_converted_to_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_converted_to_customer_id_fkey FOREIGN KEY (converted_to_customer_id) REFERENCES public.customers(id);


--
-- Name: deals deals_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: deals deals_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: deals deals_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: deals deals_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workgroups(id) ON DELETE SET NULL;


--
-- Name: drive_activities drive_activities_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_activities
    ADD CONSTRAINT drive_activities_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.drive_files(id) ON DELETE CASCADE;


--
-- Name: drive_activities drive_activities_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_activities
    ADD CONSTRAINT drive_activities_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.drive_folders(id) ON DELETE CASCADE;


--
-- Name: drive_activities drive_activities_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_activities
    ADD CONSTRAINT drive_activities_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: drive_activities drive_activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_activities
    ADD CONSTRAINT drive_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: drive_file_versions drive_file_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_file_versions
    ADD CONSTRAINT drive_file_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: drive_file_versions drive_file_versions_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_file_versions
    ADD CONSTRAINT drive_file_versions_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.drive_files(id) ON DELETE CASCADE;


--
-- Name: drive_files drive_files_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_files
    ADD CONSTRAINT drive_files_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: drive_files drive_files_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_files
    ADD CONSTRAINT drive_files_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.drive_folders(id);


--
-- Name: drive_files drive_files_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_files
    ADD CONSTRAINT drive_files_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: drive_files drive_files_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_files
    ADD CONSTRAINT drive_files_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: drive_files drive_files_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_files
    ADD CONSTRAINT drive_files_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.drive_files(id);


--
-- Name: drive_files drive_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_files
    ADD CONSTRAINT drive_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: drive_folders drive_folders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_folders
    ADD CONSTRAINT drive_folders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: drive_folders drive_folders_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_folders
    ADD CONSTRAINT drive_folders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: drive_folders drive_folders_parent_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_folders
    ADD CONSTRAINT drive_folders_parent_folder_id_fkey FOREIGN KEY (parent_folder_id) REFERENCES public.drive_folders(id) ON DELETE CASCADE;


--
-- Name: drive_folders drive_folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_folders
    ADD CONSTRAINT drive_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.drive_folders(id) ON DELETE CASCADE;


--
-- Name: drive_permissions drive_permissions_drive_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_permissions
    ADD CONSTRAINT drive_permissions_drive_id_fkey FOREIGN KEY (drive_id) REFERENCES public.connected_drives(id) ON DELETE CASCADE;


--
-- Name: drive_permissions drive_permissions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_permissions
    ADD CONSTRAINT drive_permissions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: drive_permissions drive_permissions_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_permissions
    ADD CONSTRAINT drive_permissions_role_fkey FOREIGN KEY (role) REFERENCES public.roles(id);


--
-- Name: drive_permissions drive_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_permissions
    ADD CONSTRAINT drive_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: emails emails_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: emails emails_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: emails emails_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_mailbox_id_fkey FOREIGN KEY (mailbox_id) REFERENCES public.connected_mailboxes(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_message_id_key UNIQUE (message_id);

CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON public.emails USING btree (mailbox_id);


--
-- Name: employee_documents employee_documents_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_documents employee_documents_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: employee_documents employee_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_leave_balances employee_leave_balances_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;


--
-- Name: employee_leave_balances employee_leave_balances_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: employees employees_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: employees employees_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(id);


--
-- Name: employees employees_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: employees employees_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: employees employees_reporting_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_reporting_manager_id_fkey FOREIGN KEY (reporting_manager_id) REFERENCES public.employees(id);


--
-- Name: employees employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: entity_drive_files entity_drive_files_linked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_drive_files
    ADD CONSTRAINT entity_drive_files_linked_by_fkey FOREIGN KEY (linked_by) REFERENCES public.users(id);


--
-- Name: entity_drive_files entity_drive_files_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_drive_files
    ADD CONSTRAINT entity_drive_files_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stock fk_stock_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock fk_stock_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT fk_stock_warehouse FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: hrms_notifications hrms_notifications_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hrms_notifications
    ADD CONSTRAINT hrms_notifications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: hrms_notifications hrms_notifications_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hrms_notifications
    ADD CONSTRAINT hrms_notifications_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: hrms_notifications hrms_notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hrms_notifications
    ADD CONSTRAINT hrms_notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: invoices invoices_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: invoices invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: invoices invoices_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_external_sources lead_external_sources_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_external_sources
    ADD CONSTRAINT lead_external_sources_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_external_sources lead_external_sources_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_external_sources
    ADD CONSTRAINT lead_external_sources_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_workspace_access lead_workspace_access_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspace_access
    ADD CONSTRAINT lead_workspace_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: lead_workspace_access lead_workspace_access_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspace_access
    ADD CONSTRAINT lead_workspace_access_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_workspace_access lead_workspace_access_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspace_access
    ADD CONSTRAINT lead_workspace_access_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: lead_workspaces lead_workspaces_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspaces
    ADD CONSTRAINT lead_workspaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: lead_workspaces lead_workspaces_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspaces
    ADD CONSTRAINT lead_workspaces_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_workspaces lead_workspaces_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspaces
    ADD CONSTRAINT lead_workspaces_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: leads leads_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: leads leads_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: leads leads_converted_to_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_converted_to_deal_id_fkey FOREIGN KEY (converted_to_deal_id) REFERENCES public.deals(id);


--
-- Name: leads leads_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: leads leads_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: leads leads_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: leave_balances leave_balances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: leave_request_comments leave_request_comments_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_request_comments
    ADD CONSTRAINT leave_request_comments_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE;


--
-- Name: leave_request_comments leave_request_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_request_comments
    ADD CONSTRAINT leave_request_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: leave_requests leave_requests_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: leave_types leave_types_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: leave_types leave_types_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_test_results marketing_ab_test_results_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_test_results
    ADD CONSTRAINT marketing_ab_test_results_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_test_results marketing_ab_test_results_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_test_results
    ADD CONSTRAINT marketing_ab_test_results_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.marketing_ab_tests(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_test_results marketing_ab_test_results_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_test_results
    ADD CONSTRAINT marketing_ab_test_results_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.marketing_ab_test_variants(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_test_variants marketing_ab_test_variants_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_test_variants
    ADD CONSTRAINT marketing_ab_test_variants_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.marketing_ab_tests(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_tests marketing_ab_tests_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_tests
    ADD CONSTRAINT marketing_ab_tests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_ab_tests marketing_ab_tests_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_tests
    ADD CONSTRAINT marketing_ab_tests_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_tests marketing_ab_tests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_tests
    ADD CONSTRAINT marketing_ab_tests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_campaign_events marketing_campaign_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_events
    ADD CONSTRAINT marketing_campaign_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_campaign_events marketing_campaign_events_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_events
    ADD CONSTRAINT marketing_campaign_events_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_campaigns marketing_campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_campaigns marketing_campaigns_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_campaigns marketing_campaigns_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_form_submissions marketing_form_submissions_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_form_submissions
    ADD CONSTRAINT marketing_form_submissions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: marketing_form_submissions marketing_form_submissions_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_form_submissions
    ADD CONSTRAINT marketing_form_submissions_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.marketing_forms(id) ON DELETE CASCADE;


--
-- Name: marketing_forms marketing_forms_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_forms
    ADD CONSTRAINT marketing_forms_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_forms marketing_forms_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_forms
    ADD CONSTRAINT marketing_forms_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.marketing_lists(id);


--
-- Name: marketing_forms marketing_forms_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_forms
    ADD CONSTRAINT marketing_forms_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_forms marketing_forms_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_forms
    ADD CONSTRAINT marketing_forms_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_list_members marketing_list_members_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_list_members
    ADD CONSTRAINT marketing_list_members_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_list_members marketing_list_members_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_list_members
    ADD CONSTRAINT marketing_list_members_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.marketing_lists(id) ON DELETE CASCADE;


--
-- Name: marketing_list_members marketing_list_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_list_members
    ADD CONSTRAINT marketing_list_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: marketing_lists marketing_lists_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_lists
    ADD CONSTRAINT marketing_lists_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_lists marketing_lists_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_lists
    ADD CONSTRAINT marketing_lists_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_lists marketing_lists_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_lists
    ADD CONSTRAINT marketing_lists_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_scoring_history marketing_scoring_history_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_scoring_history
    ADD CONSTRAINT marketing_scoring_history_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_scoring_history marketing_scoring_history_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_scoring_history
    ADD CONSTRAINT marketing_scoring_history_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.marketing_scoring_rules(id);


--
-- Name: marketing_scoring_rules marketing_scoring_rules_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_scoring_rules
    ADD CONSTRAINT marketing_scoring_rules_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_scoring_rules marketing_scoring_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_scoring_rules
    ADD CONSTRAINT marketing_scoring_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_segments marketing_segments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_segments
    ADD CONSTRAINT marketing_segments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_segments marketing_segments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_segments
    ADD CONSTRAINT marketing_segments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_segments marketing_segments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_segments
    ADD CONSTRAINT marketing_segments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_sequence_enrollments marketing_sequence_enrollments_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequence_enrollments
    ADD CONSTRAINT marketing_sequence_enrollments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_sequence_enrollments marketing_sequence_enrollments_sequence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequence_enrollments
    ADD CONSTRAINT marketing_sequence_enrollments_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.marketing_sequences(id) ON DELETE CASCADE;


--
-- Name: marketing_sequence_steps marketing_sequence_steps_sequence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequence_steps
    ADD CONSTRAINT marketing_sequence_steps_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.marketing_sequences(id) ON DELETE CASCADE;


--
-- Name: marketing_sequences marketing_sequences_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequences
    ADD CONSTRAINT marketing_sequences_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_sequences marketing_sequences_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequences
    ADD CONSTRAINT marketing_sequences_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_sequences marketing_sequences_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequences
    ADD CONSTRAINT marketing_sequences_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_templates marketing_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_templates
    ADD CONSTRAINT marketing_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_templates marketing_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_templates
    ADD CONSTRAINT marketing_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_templates marketing_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_templates
    ADD CONSTRAINT marketing_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_webhook_logs marketing_webhook_logs_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhook_logs
    ADD CONSTRAINT marketing_webhook_logs_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.marketing_webhooks(id) ON DELETE CASCADE;


--
-- Name: marketing_webhook_queue marketing_webhook_queue_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhook_queue
    ADD CONSTRAINT marketing_webhook_queue_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.marketing_webhooks(id) ON DELETE CASCADE;


--
-- Name: marketing_webhooks marketing_webhooks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhooks
    ADD CONSTRAINT marketing_webhooks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_webhooks marketing_webhooks_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhooks
    ADD CONSTRAINT marketing_webhooks_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_webhooks marketing_webhooks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhooks
    ADD CONSTRAINT marketing_webhooks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notification_templates notification_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notification_templates notification_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payroll payroll_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: payroll payroll_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: payroll payroll_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payroll payroll_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: product_batches product_batches_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: product_batches product_batches_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_batches product_batches_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.vendors(id);


--
-- Name: products products_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: products products_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: products products_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: products products_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.vendors(id);


--
-- Name: profiles profiles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_documents project_documents_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT project_documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_documents project_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT project_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: project_milestones project_milestones_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_milestones project_milestones_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_risks project_risks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_risks
    ADD CONSTRAINT project_risks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: project_risks project_risks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_risks
    ADD CONSTRAINT project_risks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: project_tasks project_tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_tasks project_tasks_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_parent_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES public.project_tasks(id);


--
-- Name: project_tasks project_tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_time_entries project_time_entries_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_time_entries
    ADD CONSTRAINT project_time_entries_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_time_entries project_time_entries_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_time_entries
    ADD CONSTRAINT project_time_entries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_time_entries project_time_entries_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_time_entries
    ADD CONSTRAINT project_time_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_time_entries project_time_entries_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_time_entries
    ADD CONSTRAINT project_time_entries_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.project_tasks(id);


--
-- Name: project_time_entries project_time_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_time_entries
    ADD CONSTRAINT project_time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.customers(id);


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: projects projects_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: projects projects_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: projects projects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: projects projects_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: public_holidays public_holidays_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_holidays
    ADD CONSTRAINT public_holidays_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: purchase_orders purchase_orders_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: roles roles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: roles roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: signing_parties signing_parties_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signing_parties
    ADD CONSTRAINT signing_parties_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: signing_parties signing_parties_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signing_parties
    ADD CONSTRAINT signing_parties_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stock stock_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_movements stock_movements_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: stock stock_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stock stock_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stock stock_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock stock_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: vendors vendors_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: vendors vendors_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: vendors vendors_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: warehouses warehouses_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: warehouses warehouses_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: warehouses warehouses_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: workflow_actions workflow_actions_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_actions
    ADD CONSTRAINT workflow_actions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: workflow_execution_steps workflow_execution_steps_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_execution_steps
    ADD CONSTRAINT workflow_execution_steps_action_id_fkey FOREIGN KEY (action_id) REFERENCES public.workflow_actions(id) ON DELETE CASCADE;


--
-- Name: workflow_execution_steps workflow_execution_steps_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_execution_steps
    ADD CONSTRAINT workflow_execution_steps_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.workflow_executions(id) ON DELETE CASCADE;


--
-- Name: workflow_executions workflow_executions_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_executions
    ADD CONSTRAINT workflow_executions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: workflows workflows_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workflows workflows_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: workflows workflows_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: workgroup_activities workgroup_activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_activities
    ADD CONSTRAINT workgroup_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workgroup_activities workgroup_activities_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_activities
    ADD CONSTRAINT workgroup_activities_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_channels workgroup_channels_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_channels
    ADD CONSTRAINT workgroup_channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workgroup_channels workgroup_channels_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_channels
    ADD CONSTRAINT workgroup_channels_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_files workgroup_files_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_files
    ADD CONSTRAINT workgroup_files_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.workgroup_channels(id) ON DELETE SET NULL;


--
-- Name: workgroup_files workgroup_files_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_files
    ADD CONSTRAINT workgroup_files_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.workgroup_posts(id) ON DELETE SET NULL;


--
-- Name: workgroup_files workgroup_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_files
    ADD CONSTRAINT workgroup_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: workgroup_files workgroup_files_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_files
    ADD CONSTRAINT workgroup_files_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_meeting_participants workgroup_meeting_participants_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meeting_participants
    ADD CONSTRAINT workgroup_meeting_participants_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.workgroup_meetings(id) ON DELETE CASCADE;


--
-- Name: workgroup_meeting_participants workgroup_meeting_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meeting_participants
    ADD CONSTRAINT workgroup_meeting_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workgroup_meetings workgroup_meetings_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meetings
    ADD CONSTRAINT workgroup_meetings_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.workgroup_channels(id) ON DELETE SET NULL;


--
-- Name: workgroup_meetings workgroup_meetings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meetings
    ADD CONSTRAINT workgroup_meetings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workgroup_meetings workgroup_meetings_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meetings
    ADD CONSTRAINT workgroup_meetings_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_members workgroup_members_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_members
    ADD CONSTRAINT workgroup_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id);


--
-- Name: workgroup_members workgroup_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_members
    ADD CONSTRAINT workgroup_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workgroup_members workgroup_members_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_members
    ADD CONSTRAINT workgroup_members_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_notifications workgroup_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_notifications
    ADD CONSTRAINT workgroup_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workgroup_posts workgroup_posts_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_posts
    ADD CONSTRAINT workgroup_posts_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.workgroup_channels(id) ON DELETE CASCADE;


--
-- Name: workgroup_posts workgroup_posts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_posts
    ADD CONSTRAINT workgroup_posts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.workgroup_posts(id) ON DELETE CASCADE;


--
-- Name: workgroup_posts workgroup_posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_posts
    ADD CONSTRAINT workgroup_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workgroup_posts workgroup_posts_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_posts
    ADD CONSTRAINT workgroup_posts_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_wiki workgroup_wiki_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki
    ADD CONSTRAINT workgroup_wiki_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_last_modified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES public.users(id);


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_wiki workgroup_wiki_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki
    ADD CONSTRAINT workgroup_wiki_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.workgroup_wiki(id);


--
-- Name: workgroup_wiki workgroup_wiki_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki
    ADD CONSTRAINT workgroup_wiki_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: workgroups workgroups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroups
    ADD CONSTRAINT workgroups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workgroups workgroups_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroups
    ADD CONSTRAINT workgroups_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


-- 
-- Migration: project_templates
-- 

CREATE TABLE project_templates (
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

CREATE INDEX idx_project_templates_org_id ON project_templates(org_id);
CREATE INDEX idx_project_templates_organization_id ON project_templates(organization_id);

CREATE TRIGGER update_project_templates_updated_at
    BEFORE UPDATE ON project_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


--
-- Name: project_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    invoice_number character varying(255) NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(10) DEFAULT 'USD',
    status character varying(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void', 'overdue', 'cancelled')),
    issue_date date NOT NULL,
    due_date date,
    paid_date date,
    description text,
    created_by uuid REFERENCES public.users(id),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: project_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    org_id uuid NOT NULL,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title character varying(255) NOT NULL,
    message text,
    type character varying(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    read_at timestamp without time zone,
    data jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_project_invoices_project_id ON public.project_invoices(project_id);
CREATE INDEX idx_project_invoices_org_id ON public.project_invoices(org_id);
CREATE INDEX idx_project_notifications_user_project ON public.project_notifications(user_id, project_id);

CREATE TRIGGER update_project_invoices_updated_at
    BEFORE UPDATE ON public.project_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();


-- Car Inventory Management System
-- Migration: Add Car Inventory Tables

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. CAR WORKSPACES TABLE
-- ============================================================================
DROP TABLE IF EXISTS car_workspaces CASCADE;
CREATE TABLE car_workspaces (
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
DROP TABLE IF EXISTS car_inventory CASCADE;
CREATE TABLE car_inventory (
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
DROP TABLE IF EXISTS car_documents CASCADE;
CREATE TABLE car_documents (
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
DROP TABLE IF EXISTS car_inquiries CASCADE;
CREATE TABLE car_inquiries (
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
DROP TABLE IF EXISTS car_test_drives CASCADE;
CREATE TABLE car_test_drives (
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
DROP TABLE IF EXISTS car_sales CASCADE;
CREATE TABLE car_sales (
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
DROP TABLE IF EXISTS car_service_history CASCADE;
CREATE TABLE car_service_history (
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
DROP TABLE IF EXISTS car_workspace_members CASCADE;
CREATE TABLE car_workspace_members (
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
DROP TABLE IF EXISTS car_activity_log CASCADE;
CREATE TABLE car_activity_log (
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







--
-- PostgreSQL database dump complete
--

\unrestrict 6nAeLpWtRPQc2gVIjb1HB4J8nR28v4eXgw2Pb1PtmBToqw9vYXRrVUdAFniLluf


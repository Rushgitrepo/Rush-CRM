
-- 1. Project Invoices Table
CREATE TABLE IF NOT EXISTS public.project_invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    org_id uuid NOT NULL REFERENCES public.organizations(id),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    invoice_number character varying(255) NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(10) DEFAULT 'USD',
    status character varying(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void', 'overdue')),
    issue_date date NOT NULL,
    due_date date,
    paid_date date,
    description text,
    created_by uuid REFERENCES public.users(id),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- 2. Project Notifications Table
CREATE TABLE IF NOT EXISTS public.project_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    org_id uuid NOT NULL,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title character varying(255) NOT NULL,
    message text,
    type character varying(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_invoices_project_id ON public.project_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invoices_org_id ON public.project_invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_project_notifications_user_project ON public.project_notifications(user_id, project_id);

-- Trigger for invoices
CREATE TRIGGER update_project_invoices_updated_at
    BEFORE UPDATE ON public.project_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: CRM Activity Attribution & Optimizations
-- Created: 2024-04-07

-- 1. Ensure crm_activities has optimized indices for dashboard and detail lookups
CREATE INDEX IF NOT EXISTS idx_crm_activities_org_created ON public.crm_activities(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_entity_lookup ON public.crm_activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_user_id ON public.crm_activities(user_id);

-- 2. Add description column to crm_activities if it somehow doesn't exist (safety)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_activities' AND column_name='description') THEN
        ALTER TABLE public.crm_activities ADD COLUMN description TEXT;
    END IF;
END $$;

-- 3. Ensure leads table has indices for common filters
CREATE INDEX IF NOT EXISTS idx_leads_org_status ON public.leads(org_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);

-- 4. Cleanup any orphan activities (optional but good for consistency)
-- DELETE FROM public.crm_activities WHERE user_id IS NULL AND org_id IS NULL;

-- 5. Update any 'Someone' activities to 'System' attribution conceptually 
-- (Our SQL fallback handles this dynamically, but we can also set metadata)
COMMENT ON COLUMN public.crm_activities.user_id IS 'NULL user_id indicates a System or Automated activity';

-- Add missing columns to invites table
ALTER TABLE public.invites 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE  

-- Create index for better performance on token lookups
CREATE INDEX IF NOT EXISTS idx_invites_expires_at ON public.invites (expires_at);

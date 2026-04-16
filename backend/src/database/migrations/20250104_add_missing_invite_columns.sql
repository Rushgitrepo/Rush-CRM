-- Add missing columns to invites table
ALTER TABLE public.invites 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE  


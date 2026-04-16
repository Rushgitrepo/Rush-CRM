-- Migration: Rename 'name' column to 'full_name' in invites table
-- Date: 2025-01-03
-- Description: Update invites table to use 'full_name' instead of 'name' for consistency with users table

-- Rename the column
ALTER TABLE public.invites RENAME COLUMN name TO full_name;

-- Update any existing indexes if they reference the old column name
-- (No specific indexes found for the name column, but this is a placeholder for future reference)

-- Add comment for documentation
COMMENT ON COLUMN public.invites.full_name IS 'Full name of the invited user (renamed from name for consistency)';
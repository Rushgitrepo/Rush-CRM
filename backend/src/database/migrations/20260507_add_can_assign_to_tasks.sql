-- Add can_assign column to tasks table to allow hierarchical delegation
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS can_assign BOOLEAN DEFAULT false;

-- Admins and Super Admins should always be able to assign, but for specific tasks,
-- we'll use this column to control if the assignee can delegate further.

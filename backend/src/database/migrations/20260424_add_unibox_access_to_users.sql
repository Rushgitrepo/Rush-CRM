-- Add unibox access column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_unibox_access BOOLEAN DEFAULT FALSE;

-- Grant access to Musaddaq by default
UPDATE users 
SET has_unibox_access = TRUE 
WHERE id = '5d546e42-fae2-4d4e-82bc-9cb186d720c6';

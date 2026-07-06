-- ============================================================
-- NGMarket / KOBA Integration — Client Projects Table Update
-- Paste this script into your Supabase SQL Editor and run it
-- ============================================================

-- Add columns to link client projects with KOBA accounts
ALTER TABLE plans.client_projects 
ADD COLUMN IF NOT EXISTS koba_account_id text,
ADD COLUMN IF NOT EXISTS koba_account_name text,
ADD COLUMN IF NOT EXISTS koba_account_type text;

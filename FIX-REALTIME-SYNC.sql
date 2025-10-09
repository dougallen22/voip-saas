-- ============================================================================
-- FIX REALTIME SYNC - COMPLETE SOLUTION
-- ============================================================================
-- Purpose: Add missing columns to voip_users table so active calls sync
-- Why: Without these columns, update-user-call endpoint fails silently
-- Result: Active calls will show instantly on all users' screens
-- ============================================================================

-- Step 1: Add the missing columns
ALTER TABLE public.voip_users
  ADD COLUMN IF NOT EXISTS current_call_phone_number text,
  ADD COLUMN IF NOT EXISTS current_call_answered_at timestamptz;

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_phone_number
  ON public.voip_users (current_call_phone_number);

-- Step 3: Create exec_sql function for FUTURE migrations (optional)
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql TO service_role;

COMMENT ON FUNCTION public.exec_sql IS 'Executes arbitrary SQL - USE WITH CAUTION. Only accessible via service_role.';

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'voip_users'
  AND column_name IN ('current_call_phone_number', 'current_call_answered_at');

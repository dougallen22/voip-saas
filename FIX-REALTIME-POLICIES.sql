-- ============================================================================
-- FIX REALTIME SUBSCRIPTIONS FOR VOIP_USERS
-- ============================================================================
-- Purpose: Add RLS policy to allow all authenticated users to SELECT from voip_users
-- Why: Supabase Realtime only broadcasts events for rows users can SELECT
-- Result: Rhonda will instantly see when Doug answers a call (and vice versa)
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE public.voip_users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to view all voip_users
-- This is necessary for realtime subscriptions to work
CREATE POLICY "Allow authenticated users to view all voip_users"
ON public.voip_users
FOR SELECT
TO authenticated
USING (true);

-- Also allow service_role full access (for backend operations)
CREATE POLICY "Allow service_role full access to voip_users"
ON public.voip_users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Verify policies were created
SELECT
  policyname,
  cmd,
  roles::text[]
FROM pg_policies
WHERE tablename = 'voip_users';

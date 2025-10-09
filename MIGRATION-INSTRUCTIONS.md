# How to Run SQL Migrations

## Problem
Claude Code cannot execute DDL statements (ALTER TABLE, CREATE INDEX, etc.) directly because:
1. Supabase service role can query but cannot execute DDL
2. The `exec_sql` RPC function doesn't exist in your database
3. Direct PostgreSQL connections require credentials

## Solution: Two-Step Process

### Step 1: Create the `exec_sql` Helper Function (ONE TIME ONLY)

Go to: https://supabase.com/dashboard/project/zcosbiwvstrwmyioqdjw/sql/new

Paste and run this SQL:

```sql
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Grant execute permission to service_role
GRANT EXECUTE ON FUNCTION public.exec_sql TO service_role;

COMMENT ON FUNCTION public.exec_sql IS 'Executes arbitrary SQL - USE WITH CAUTION. Only accessible via service_role.';
```

### Step 2: Run Migrations via Node Script

After creating the function, you can run migrations like this:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://zcosbiwvstrwmyioqdjw.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... \
node add-columns-now.js
```

## Current Migration Needed

**Purpose:** Add `current_call_phone_number` and `current_call_answered_at` columns to `voip_users` table.

**Why:** Without these columns, the `update-user-call` endpoint fails when trying to update call information, so Rhonda never sees when you're on an active call.

**SQL:**
\`\`\`sql
ALTER TABLE public.voip_users
  ADD COLUMN IF NOT EXISTS current_call_phone_number text,
  ADD COLUMN IF NOT EXISTS current_call_answered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_phone_number
  ON public.voip_users (current_call_phone_number);
\`\`\`

## Documentation for Future
- Always create migrations in `database/migrations/` or `supabase/migrations/`
- Use the `exec_sql` function via Node scripts for automated migrations
- For one-off changes, use Supabase SQL Editor directly
- Test migrations locally first if possible

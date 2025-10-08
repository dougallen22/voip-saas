# Database Setup Instructions

Since we cannot run SQL directly via the API, please follow these steps to set up your VOIP database:

## Step 1: Access Supabase SQL Editor

1. Go to your VOIP Supabase project: https://supabase.com/dashboard/project/mzqsyvjzvzknxiidwcmt
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"

## Step 2: Run Migration 1 - Organizations Table

Copy and paste this SQL and click "Run":

```sql
-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  twilio_number TEXT,
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_api_key TEXT,
  twilio_api_secret TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.organizations IS 'Organizations (tenants) in the VoIP CRM system';
```

## Step 3: Run Migration 2 - VoIP Users Table

Create a new query and run:

```sql
-- Create voip_users table
CREATE TABLE IF NOT EXISTS public.voip_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('super_admin', 'tenant_admin', 'agent')),
  is_available BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.voip_users ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS voip_users_organization_id_idx ON public.voip_users(organization_id);
CREATE INDEX IF NOT EXISTS voip_users_is_available_idx ON public.voip_users(is_available);

COMMENT ON TABLE public.voip_users IS 'VoIP users with role and availability status';
```

## Step 4: Run Migration 3 - Calls Table

Create a new query and run:

```sql
-- Create calls table
CREATE TABLE IF NOT EXISTS public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  twilio_call_sid TEXT UNIQUE NOT NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  answered_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'in-progress', 'completed', 'busy', 'no-answer', 'canceled', 'failed')),
  duration INTEGER,
  recording_url TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS calls_organization_id_idx ON public.calls(organization_id);
CREATE INDEX IF NOT EXISTS calls_answered_by_user_id_idx ON public.calls(answered_by_user_id);
CREATE INDEX IF NOT EXISTS calls_twilio_call_sid_idx ON public.calls(twilio_call_sid);
CREATE INDEX IF NOT EXISTS calls_status_idx ON public.calls(status);
CREATE INDEX IF NOT EXISTS calls_created_at_idx ON public.calls(created_at DESC);

COMMENT ON TABLE public.calls IS 'VoIP call records with Twilio integration';
```

## Step 5: Verify Tables Were Created

Run this query to verify:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('organizations', 'voip_users', 'calls');
```

You should see all three tables listed.

## Next Steps

Once these tables are created, let me know and I'll continue with:
- RLS policies
- Database triggers
- Auth setup


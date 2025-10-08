import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseServiceKey || supabaseServiceKey === 'get-from-supabase-dashboard') {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY not configured. Please add it to .env.local' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Step 1: Create organizations table
    const { error: orgError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    })

    if (orgError) {
      console.error('Organizations table error:', orgError)
      return NextResponse.json({ error: 'Failed to create organizations table', details: orgError }, { status: 500 })
    }

    // Step 2: Create voip_users table
    const { error: usersError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    })

    if (usersError) {
      console.error('VoIP users table error:', usersError)
      return NextResponse.json({ error: 'Failed to create voip_users table', details: usersError }, { status: 500 })
    }

    // Step 3: Create calls table
    const { error: callsError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    })

    if (callsError) {
      console.error('Calls table error:', callsError)
      return NextResponse.json({ error: 'Failed to create calls table', details: callsError }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Database schema created successfully',
      tables: ['organizations', 'voip_users', 'calls']
    })

  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({ error: 'Failed to setup database', details: error }, { status: 500 })
  }
}

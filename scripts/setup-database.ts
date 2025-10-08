import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
  console.log('🚀 Setting up VoIP CRM database...\n')

  try {
    // Step 1: Create organizations table
    console.log('📋 Creating organizations table...')
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
      `
    })

    if (orgError) {
      console.error('❌ Error creating organizations table:', orgError)
      throw orgError
    }
    console.log('✅ Organizations table created\n')

    // Step 2: Create voip_users table
    console.log('👥 Creating voip_users table...')
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
      `
    })

    if (usersError) {
      console.error('❌ Error creating voip_users table:', usersError)
      throw usersError
    }
    console.log('✅ VoIP users table created\n')

    // Step 3: Create calls table
    console.log('📞 Creating calls table...')
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
      `
    })

    if (callsError) {
      console.error('❌ Error creating calls table:', callsError)
      throw callsError
    }
    console.log('✅ Calls table created\n')

    console.log('🎉 Database setup complete!\n')
    console.log('Tables created:')
    console.log('  - organizations')
    console.log('  - voip_users')
    console.log('  - calls')

  } catch (error) {
    console.error('❌ Setup failed:', error)
    process.exit(1)
  }
}

setupDatabase()

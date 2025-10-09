import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('🚀 Running migration to add columns...')

    // Create a function that will add the columns
    const migrationSQL = `
      DO $$
      BEGIN
        -- Add current_call_phone_number if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'voip_users'
          AND column_name = 'current_call_phone_number'
        ) THEN
          ALTER TABLE public.voip_users ADD COLUMN current_call_phone_number text;
          RAISE NOTICE 'Added current_call_phone_number column';
        END IF;

        -- Add current_call_answered_at if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'voip_users'
          AND column_name = 'current_call_answered_at'
        ) THEN
          ALTER TABLE public.voip_users ADD COLUMN current_call_answered_at timestamptz;
          RAISE NOTICE 'Added current_call_answered_at column';
        END IF;

        -- Create index if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public'
          AND tablename = 'voip_users'
          AND indexname = 'idx_voip_users_current_call_phone_number'
        ) THEN
          CREATE INDEX idx_voip_users_current_call_phone_number
          ON public.voip_users (current_call_phone_number);
          RAISE NOTICE 'Created index on current_call_phone_number';
        END IF;
      END $$;
    `

    // We can't execute DDL via Supabase client, so return the SQL to run
    return NextResponse.json({
      success: false,
      message: 'Cannot execute DDL statements via service role. Run this SQL manually in Supabase SQL Editor:',
      sql: migrationSQL,
      supabaseURL: `https://supabase.com/dashboard/project/zcosbiwvstrwmyioqdjw/sql/new`
    })

  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    if (!supabaseServiceKey || supabaseServiceKey === 'get-from-supabase-dashboard') {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Add daily count columns to voip_users table
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add daily call count columns to voip_users table
        ALTER TABLE public.voip_users
        ADD COLUMN IF NOT EXISTS today_inbound_calls INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS today_outbound_calls INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_count_reset_date DATE DEFAULT CURRENT_DATE;

        -- Add index for better query performance on reset date
        CREATE INDEX IF NOT EXISTS voip_users_last_count_reset_date_idx ON public.voip_users(last_count_reset_date);

        -- Create function to reset daily counts
        CREATE OR REPLACE FUNCTION reset_daily_call_counts()
        RETURNS void AS $$
        BEGIN
          UPDATE public.voip_users
          SET
            today_inbound_calls = 0,
            today_outbound_calls = 0,
            last_count_reset_date = CURRENT_DATE
          WHERE last_count_reset_date < CURRENT_DATE;
        END;
        $$ LANGUAGE plpgsql;
      `
    })

    if (error) {
      console.error('Migration error:', error)
      return NextResponse.json({
        error: 'Failed to add daily count columns',
        details: error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Daily count columns added successfully to voip_users table'
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      error: 'Failed to run migration',
      details: error
    }, { status: 500 })
  }
}

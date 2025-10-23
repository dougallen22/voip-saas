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

    // Add weekly, monthly, yearly count columns
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add weekly, monthly, and yearly call count columns to voip_users table
        ALTER TABLE public.voip_users
        ADD COLUMN IF NOT EXISTS weekly_inbound_calls INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS weekly_outbound_calls INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_week_reset_date DATE DEFAULT CURRENT_DATE,
        ADD COLUMN IF NOT EXISTS monthly_inbound_calls INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS monthly_outbound_calls INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_month_reset_date DATE DEFAULT CURRENT_DATE,
        ADD COLUMN IF NOT EXISTS yearly_inbound_calls INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS yearly_outbound_calls INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_year_reset_date DATE DEFAULT CURRENT_DATE;

        -- Add indexes for better query performance
        CREATE INDEX IF NOT EXISTS voip_users_last_week_reset_date_idx ON public.voip_users(last_week_reset_date);
        CREATE INDEX IF NOT EXISTS voip_users_last_month_reset_date_idx ON public.voip_users(last_month_reset_date);
        CREATE INDEX IF NOT EXISTS voip_users_last_year_reset_date_idx ON public.voip_users(last_year_reset_date);

        -- Update the reset function to handle all time periods
        CREATE OR REPLACE FUNCTION reset_call_counts()
        RETURNS void AS $$
        BEGIN
          -- Reset daily counts (if new day)
          UPDATE public.voip_users
          SET
            today_inbound_calls = 0,
            today_outbound_calls = 0,
            last_count_reset_date = CURRENT_DATE
          WHERE last_count_reset_date < CURRENT_DATE;

          -- Reset weekly counts (if new week - Monday is start of week)
          UPDATE public.voip_users
          SET
            weekly_inbound_calls = 0,
            weekly_outbound_calls = 0,
            last_week_reset_date = CURRENT_DATE
          WHERE last_week_reset_date < DATE_TRUNC('week', CURRENT_DATE);

          -- Reset monthly counts (if new month)
          UPDATE public.voip_users
          SET
            monthly_inbound_calls = 0,
            monthly_outbound_calls = 0,
            last_month_reset_date = CURRENT_DATE
          WHERE last_month_reset_date < DATE_TRUNC('month', CURRENT_DATE);

          -- Reset yearly counts (if new year)
          UPDATE public.voip_users
          SET
            yearly_inbound_calls = 0,
            yearly_outbound_calls = 0,
            last_year_reset_date = CURRENT_DATE
          WHERE last_year_reset_date < DATE_TRUNC('year', CURRENT_DATE);
        END;
        $$ LANGUAGE plpgsql;

        -- Drop old function if exists
        DROP FUNCTION IF EXISTS reset_daily_call_counts();
      `
    })

    if (error) {
      console.error('Migration error:', error)
      return NextResponse.json({
        error: 'Failed to add period count columns',
        details: error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Weekly, monthly, and yearly count columns added successfully to voip_users table'
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      error: 'Failed to run migration',
      details: error
    }, { status: 500 })
  }
}

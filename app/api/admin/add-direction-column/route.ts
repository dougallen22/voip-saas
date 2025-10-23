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

    // Add direction column to calls table
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add direction column to calls table
        ALTER TABLE public.calls
        ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound', 'outbound'));

        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS calls_direction_idx ON public.calls(direction);

        -- Backfill direction from metadata for existing records
        UPDATE public.calls
        SET direction = (metadata->>'direction')::TEXT
        WHERE direction IS NULL AND metadata->>'direction' IS NOT NULL;
      `
    })

    if (alterError) {
      console.error('Migration error:', alterError)
      return NextResponse.json({
        error: 'Failed to add direction column',
        details: alterError
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Direction column added successfully to calls table'
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      error: 'Failed to run migration',
      details: error
    }, { status: 500 })
  }
}

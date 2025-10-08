import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('Running migration: Make twilio_conference_sid nullable')

    // Use the Postgres client directly
    const { data, error } = await supabase
      .from('parked_calls')
      .select('twilio_conference_sid')
      .limit(1)

    if (error) {
      return NextResponse.json({
        error: 'Cannot connect to database',
        details: error.message
      }, { status: 500 })
    }

    // Since we can't run DDL via the Supabase client, we'll return instructions
    return NextResponse.json({
      success: false,
      message: 'Please run this SQL in your Supabase SQL Editor:',
      sql: 'ALTER TABLE parked_calls ALTER COLUMN twilio_conference_sid DROP NOT NULL;',
      instructions: [
        '1. Go to https://supabase.com/dashboard',
        '2. Select your project',
        '3. Click "SQL Editor" in the left sidebar',
        '4. Click "New Query"',
        '5. Paste the SQL above',
        '6. Click "Run"'
      ]
    })
  } catch (error: any) {
    console.error('Error running migration:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

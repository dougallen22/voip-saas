import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const sqlPath = path.join(process.cwd(), 'COMPLETE-MULTI-AGENT-MIGRATION.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('SELECT'))

    console.log(`📝 Running ${statements.length} SQL statements...`)

    const results = []
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      if (!stmt) continue

      console.log(`  ${i + 1}. ${stmt.substring(0, 60)}...`)

      // Execute via raw SQL
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: stmt + ';'
      })

      if (error) {
        console.error(`  ❌ Error:`, error)
        results.push({ index: i, error: error.message, statement: stmt.substring(0, 100) })
      } else {
        console.log(`  ✅ Success`)
        results.push({ index: i, success: true })
      }
    }

    // Verify tables
    const { data: claimsCheck } = await supabase
      .from('call_claims')
      .select('id')
      .limit(1)

    const { data: eventsCheck } = await supabase
      .from('ring_events')
      .select('id')
      .limit(1)

    return NextResponse.json({
      success: true,
      results,
      verification: {
        call_claims: claimsCheck !== null,
        ring_events: eventsCheck !== null
      }
    })

  } catch (error: any) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

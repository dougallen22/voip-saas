import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get all calls
    const { data: allCalls } = await adminClient
      .from('calls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    // Get all voip_users with current_call_id
    const { data: usersWithCalls } = await adminClient
      .from('voip_users')
      .select('id, email, current_call_id, is_available, role')
      .not('current_call_id', 'is', null)

    // Get active calls (ringing, active, parked)
    const { data: activeCalls } = await adminClient
      .from('calls')
      .select('*')
      .in('status', ['ringing', 'active', 'parked'])

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      allCalls: allCalls || [],
      usersWithCalls: usersWithCalls || [],
      activeCalls: activeCalls || [],
      summary: {
        totalCalls: allCalls?.length || 0,
        usersOnCalls: usersWithCalls?.length || 0,
        activeCallsCount: activeCalls?.length || 0,
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

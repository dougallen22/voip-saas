import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { callId, agentId } = await request.json()

    if (!callId) {
      return NextResponse.json({ error: 'Call ID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get current call to calculate duration
    const { data: currentCall } = await adminClient
      .from('calls')
      .select('started_at')
      .eq('id', callId)
      .single()

    const duration = currentCall?.started_at
      ? Math.floor((new Date().getTime() - new Date(currentCall.started_at).getTime()) / 1000)
      : 0

    // Update call status to completed
    const { data: call, error: callError } = await adminClient
      .from('calls')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration,
      })
      .eq('id', callId)
      .select()
      .single()

    if (callError) {
      return NextResponse.json({ error: callError.message }, { status: 500 })
    }

    // Set agent back to available if agentId provided
    if (agentId) {
      await adminClient
        .from('voip_users')
        .update({ is_available: true })
        .eq('id', agentId)
    }

    return NextResponse.json({
      success: true,
      call: {
        id: call.id,
        status: call.status,
        duration: call.duration,
      },
    })
  } catch (error: any) {
    console.error('End call error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

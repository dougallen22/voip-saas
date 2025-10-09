import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { callSid, agentId } = body

    if (!callSid || !agentId) {
      return NextResponse.json(
        { error: 'Missing required fields: callSid, agentId' },
        { status: 400 }
      )
    }

    console.log('🎯 CLAIM ATTEMPT:', { callSid, agentId, timestamp: new Date().toISOString() })

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Try to atomically claim the call using the database function
    const { data, error } = await adminClient.rpc('claim_call', {
      p_call_sid: callSid,
      p_agent_id: agentId
    })

    if (error) {
      console.error('❌ CLAIM ERROR:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 })
    }

    // data will be true if claim succeeded, false if already claimed
    if (!data) {
      console.log('⚠️ CLAIM RACE LOST:', { callSid, agentId })
      return NextResponse.json({
        success: false,
        error: 'Call already claimed by another agent'
      }, { status: 409 }) // Conflict
    }

    console.log('✅ CLAIM SUCCESS:', { callSid, agentId })

    // CRITICAL: Delete ALL active_calls rows for this call IMMEDIATELY
    // This clears other agents' incoming call UI via real-time DELETE events
    // Must happen BEFORE acceptCall() is called in the frontend
    console.log('🧹 IMMEDIATELY deleting ALL active_calls for call:', callSid)
    const { error: deleteError } = await adminClient
      .from('active_calls')
      .delete()
      .eq('call_sid', callSid)

    if (deleteError) {
      console.error('❌ CRITICAL: Failed to delete active_calls:', deleteError)
    } else {
      console.log('✅ DELETED all active_calls - other agents\' screens will clear NOW')
    }

    // Broadcast answered event for ring coordination
    const { error: ringError } = await adminClient
      .from('ring_events')
      .insert({
        call_sid: callSid,
        agent_id: agentId,
        event_type: 'answered'
      })

    if (ringError) {
      console.error('Warning: Failed to broadcast ring event:', ringError)
    }

    // NOTE: The answering agent's active_calls row and voip_users update
    // will be handled by update-user-call when Twilio accept event fires

    return NextResponse.json({
      success: true,
      claimedBy: agentId
    })

  } catch (error: any) {
    console.error('❌ Error in claim-call:', error)
    return NextResponse.json({
      error: error.message || 'Failed to claim call'
    }, { status: 500 })
  }
}

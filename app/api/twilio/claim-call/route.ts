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

    // Update active_calls to 'active' status for this agent
    const { error: activeCallError } = await adminClient
      .from('active_calls')
      .update({ status: 'active' })
      .eq('call_sid', callSid)
      .eq('agent_id', agentId)

    if (activeCallError) {
      console.error('Warning: Failed to update active_calls:', activeCallError)
    }

    // Delete active_calls entries for other agents (they didn't answer)
    const { error: deleteOthersError } = await adminClient
      .from('active_calls')
      .delete()
      .eq('call_sid', callSid)
      .neq('agent_id', agentId)

    if (deleteOthersError) {
      console.error('Warning: Failed to delete other active_calls:', deleteOthersError)
    }

    // Broadcast ring cancellation event to other agents
    const { error: ringError } = await adminClient
      .from('ring_events')
      .insert({
        call_sid: callSid,
        agent_id: agentId,
        event_type: 'answered'
      })

    if (ringError) {
      console.error('Warning: Failed to broadcast ring event:', ringError)
      // Don't fail the claim - event is just for UI coordination
    }

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

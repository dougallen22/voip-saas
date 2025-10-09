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

    // Get the call record to get the call ID
    const { data: callRecord, error: callFetchError } = await adminClient
      .from('calls')
      .select('id')
      .eq('twilio_call_sid', callSid)
      .single()

    if (callFetchError) {
      console.error('Warning: Failed to fetch call record:', callFetchError)
    }

    const callId = callRecord?.id

    // Update the calls table to assign to this agent
    if (callId) {
      const { error: updateCallError } = await adminClient
        .from('calls')
        .update({
          assigned_to: agentId,
          status: 'active'
        })
        .eq('id', callId)

      if (updateCallError) {
        console.error('Warning: Failed to update call assignment:', updateCallError)
      } else {
        console.log('✅ Updated calls table - assigned to agent')
      }
    }

    // Update voip_users to show agent is on a call
    // This is what triggers the UI to show the active call in the user card!
    if (callId) {
      const { error: updateUserError } = await adminClient
        .from('voip_users')
        .update({ current_call_id: callId })
        .eq('id', agentId)

      if (updateUserError) {
        console.error('Warning: Failed to update user current_call_id:', updateUserError)
      } else {
        console.log('✅ Updated voip_users.current_call_id - UI will show active call in user card!')
      }
    }

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
    } else {
      console.log('✅ Deleted active_calls for other agents - their incoming calls will clear!')
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

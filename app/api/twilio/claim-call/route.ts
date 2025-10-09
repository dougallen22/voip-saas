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

    // Get the call record to get the call ID and phone number
    const { data: callRecord, error: callFetchError } = await adminClient
      .from('calls')
      .select('id, from_number, answered_at')
      .eq('twilio_call_sid', callSid)
      .single()

    if (callFetchError) {
      console.error('Warning: Failed to fetch call record:', callFetchError)
    }

    const callId = callRecord?.id
    const callerNumber = callRecord?.from_number

    // Update the calls table to assign to this agent and mark as answered
    if (callId) {
      const { error: updateCallError } = await adminClient
        .from('calls')
        .update({
          assigned_to: agentId,
          status: 'active',
          answered_at: new Date().toISOString()
        })
        .eq('id', callId)

      if (updateCallError) {
        console.error('Warning: Failed to update call assignment:', updateCallError)
      } else {
        console.log('✅ Updated calls table - assigned to agent and marked as active')
      }
    }

    // Update voip_users to show agent is on a call with caller number
    // This is CRITICAL for real-time sync to all users!
    if (callId) {
      const { error: updateUserError } = await adminClient
        .from('voip_users')
        .update({
          current_call_id: callId,
          current_call_phone_number: callerNumber,
          current_call_answered_at: new Date().toISOString()
        })
        .eq('id', agentId)

      if (updateUserError) {
        console.error('Warning: Failed to update voip_users:', updateUserError)
      } else {
        console.log('✅ Updated voip_users - all users will see active call via realtime!')
      }
    }

    // CRITICAL FIX: First, delete ALL active_calls for other agents (they didn't answer)
    // This MUST happen BEFORE updating the answering agent's row to ensure real-time sync
    const { error: deleteOthersError } = await adminClient
      .from('active_calls')
      .delete()
      .eq('call_sid', callSid)
      .neq('agent_id', agentId)

    if (deleteOthersError) {
      console.error('Warning: Failed to delete other active_calls:', deleteOthersError)
    } else {
      console.log('✅ Deleted active_calls for other agents - their incoming calls will clear via realtime!')
    }

    // Then update the answering agent's active_calls row to 'active' status
    const { error: activeCallError } = await adminClient
      .from('active_calls')
      .update({ status: 'active' })
      .eq('call_sid', callSid)
      .eq('agent_id', agentId)

    if (activeCallError) {
      console.error('Warning: Failed to update active_calls:', activeCallError)
    } else {
      console.log('✅ Updated answering agent active_calls to "active" status')
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

import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import twilio from 'twilio'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    console.log('🚨 ===UPDATE-USER-CALL ENDPOINT HIT===')
    const body = await request.json()
    console.log('🚨 Request body:', JSON.stringify(body, null, 2))
    const { callSid, agentId, action } = body

    if (!callSid || !agentId || !action) {
      console.error('❌ MISSING REQUIRED FIELDS:', { callSid, agentId, action })
      return NextResponse.json(
        { error: 'Missing required fields: callSid, agentId, action' },
        { status: 400 }
      )
    }

    console.log('🚨 update-user-call PROCESSING:', { callSid, agentId, action, timestamp: new Date().toISOString() })

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const updateUserCallState = async (fields: Record<string, any>) => {
      const { error } = await adminClient
        .from('voip_users')
        .update(fields)
        .eq('id', agentId)

      if (!error) return

      if (
        Object.prototype.hasOwnProperty.call(fields, 'current_call_phone_number') &&
        error.message?.toLowerCase().includes('current_call_phone_number')
      ) {
        console.warn(
          '⚠️ current_call_phone_number column missing; retrying without phone number column'
        )
        const fallbackFields = { ...fields }
        delete fallbackFields.current_call_phone_number

        const { error: fallbackError } = await adminClient
          .from('voip_users')
          .update(fallbackFields)
          .eq('id', agentId)

        if (!fallbackError) {
          return
        }

        throw fallbackError
      }

      throw error
    }

    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )

    if (action === 'start') {
      // The callSid we receive is from the browser client (child call)
      // We need to get the parent call (PSTN caller) - SAME AS PARKING LOT!
      let pstnCallSid = callSid

      try {
        const call = await twilioClient.calls(callSid).fetch()
        console.log('Fetched browser client call:', {
          sid: call.sid,
          parentCallSid: call.parentCallSid,
          direction: call.direction
        })

        // If this is a client call with a parent, use the parent SID
        if (call.parentCallSid) {
          pstnCallSid = call.parentCallSid
          console.log('✅ Using parent call SID:', pstnCallSid)
        }
      } catch (fetchError: any) {
        console.log('⚠️ Could not fetch call details, using original SID:', fetchError.message)
      }

      // Get the call record using the PSTN call SID
      const { data: callRecord, error: callFetchError } = await adminClient
        .from('calls')
        .select('id, from_number, answered_at')
        .eq('twilio_call_sid', pstnCallSid)
        .single()

      if (callFetchError || !callRecord) {
        console.error('❌ Failed to fetch call record:', callFetchError)
        console.error('Searched for twilio_call_sid:', pstnCallSid)
        return NextResponse.json({
          success: false,
          error: 'Call not found in database'
        }, { status: 404 })
      }

      const callId = callRecord.id
      console.log('✅ Found call record:', { callId, pstnCallSid })

      const phoneNumber = callRecord.from_number || null

      // Insert active_calls row for THIS agent with status='active'
      // (Other agents' rows were already deleted by claim-call endpoint)
      console.log('➕ Inserting active_calls for answering agent:', agentId)
      const { error: insertActiveCallError } = await adminClient
        .from('active_calls')
        .insert({
          call_sid: pstnCallSid,
          agent_id: agentId,
          caller_number: phoneNumber || 'Unknown',
          status: 'active'
        })

      if (insertActiveCallError) {
        console.error('❌ Failed to insert active_call:', insertActiveCallError)
      } else {
        console.log('✅ Inserted active_call with status=active for answering agent')
      }

      // Update voip_users to set current_call_id
      await updateUserCallState({
        current_call_id: callId,
        current_call_phone_number: phoneNumber,
        current_call_answered_at: new Date().toISOString()
      })

      console.log('✅ Updated voip_users.current_call_id')

      // Also update calls table status to 'active' and assigned_to
      const { error: updateCallError } = await adminClient
        .from('calls')
        .update({
          assigned_to: agentId,
          status: 'active',
          answered_at: new Date().toISOString()
        })
        .eq('id', callId)

      if (updateCallError) {
        console.error('❌ Failed to update call status:', updateCallError)
      }

      console.log('✅ Database updated - ALL users will see active call instantly!', { agentId, callId })

      // Broadcast ring cancellation event to other agents for coordination
      const { error: ringError } = await adminClient
        .from('ring_events')
        .insert({
          call_sid: pstnCallSid,
          agent_id: agentId,
          event_type: 'answered'
        })

      if (ringError) {
        console.error('Warning: Failed to broadcast ring event:', ringError)
        // Don't fail - event is just for UI coordination
      } else {
        console.log('✅ Broadcast ring event - other agents will clear incoming call UI')
      }

      return NextResponse.json({
        success: true,
        callId
      })

    } else if (action === 'end') {
      // The callSid we receive is from the browser client (child call)
      // We need to get the parent call (PSTN caller) - SAME AS PARKING LOT!
      let pstnCallSid = callSid

      try {
        const call = await twilioClient.calls(callSid).fetch()
        if (call.parentCallSid) {
          pstnCallSid = call.parentCallSid
          console.log('✅ Using parent call SID for disconnect:', pstnCallSid)
        }
      } catch (fetchError: any) {
        console.log('⚠️ Could not fetch call details, using original SID:', fetchError.message)
      }

      // Delete ALL active_calls for this call (cleanup)
      console.log('🧹 Deleting ALL active_calls for ended call:', pstnCallSid)
      const { error: deleteActiveCallsError } = await adminClient
        .from('active_calls')
        .delete()
        .eq('call_sid', pstnCallSid)

      if (deleteActiveCallsError) {
        console.error('❌ Failed to delete active_calls:', deleteActiveCallsError)
      } else {
        console.log('✅ Deleted all active_calls for ended call')
      }

      // Clear current_call_id AND phone number for this agent
      try {
        await updateUserCallState({
          current_call_id: null,
          current_call_phone_number: null,
          current_call_answered_at: null
        })
      } catch (updateUserError: any) {
        console.error('❌ Failed to clear user current_call_id:', updateUserError)
        return NextResponse.json({
          success: false,
          error: updateUserError.message
        }, { status: 500 })
      }

      // Update call status to 'completed' using PSTN call SID
      const { error: updateCallError } = await adminClient
        .from('calls')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString()
        })
        .eq('twilio_call_sid', pstnCallSid)

      if (updateCallError) {
        console.error('❌ Failed to update call status:', updateCallError)
      }

      console.log('✅ Database updated - current_call_id cleared for agent', { agentId, pstnCallSid })

      return NextResponse.json({
        success: true
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "start" or "end"' },
        { status: 400 }
      )
    }

  } catch (error: any) {
    console.error('❌ Error in update-user-call:', error)
    return NextResponse.json({
      error: error.message || 'Failed to update user call'
    }, { status: 500 })
  }
}

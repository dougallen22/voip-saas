import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import twilio from 'twilio'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { parkedCallId, newAgentId } = body

    if (!parkedCallId || !newAgentId) {
      return NextResponse.json(
        { error: 'Missing required fields: parkedCallId, newAgentId' },
        { status: 400 }
      )
    }

    console.log('🎯 UNPARKING CALL:', { parkedCallId, newAgentId })

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )

    // Get the parked call from database with row-level locking to prevent race conditions
    const { data: parkedCall, error: fetchError } = await adminClient
      .from('parked_calls')
      .select('*')
      .eq('id', parkedCallId)
      .single()

    if (fetchError || !parkedCall) {
      console.error('Parked call not found:', fetchError)
      return NextResponse.json(
        { error: 'Parked call not found' },
        { status: 404 }
      )
    }

    console.log('Found parked call:', {
      conferenceSid: parkedCall.twilio_conference_sid,
      participantSid: parkedCall.twilio_participant_sid,
      caller: parkedCall.caller_number,
      metadata: parkedCall.metadata,
    })

    // The twilio_participant_sid is the PSTN call SID
    const pstnCallSid = parkedCall.twilio_participant_sid

    // Signal to target agent's browser that a transfer is incoming
    // This happens BEFORE the Twilio redirect so the browser is ready
    const { error: ringEventError } = await adminClient.from('ring_events').insert({
      call_sid: parkedCall.twilio_conference_sid || pstnCallSid,
      agent_id: newAgentId,
      event_type: 'transfer_start'
    })

    if (ringEventError) {
      console.error('Warning: Failed to create transfer_start ring event:', ringEventError)
    } else {
      console.log(`📡 Sent transfer_start ring event to agent: ${newAgentId}`)
    }

    // Verify the PSTN call is still active
    let pstnCall
    try {
      pstnCall = await twilioClient.calls(pstnCallSid).fetch()
      console.log('PSTN call status:', pstnCall.status)

      if (pstnCall.status === 'completed' || pstnCall.status === 'canceled') {
        throw new Error(`Call has already ended (${pstnCall.status})`)
      }
    } catch (fetchError: any) {
      console.error('Error fetching PSTN call:', fetchError)
      throw new Error(`Failed to retrieve call: ${fetchError.message}`)
    }

    // Generate TwiML to connect the parked call to the new agent's browser client
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="30">
    <Client>${newAgentId}</Client>
  </Dial>
  <Hangup/>
</Response>`

    // Delete from parked_calls table BEFORE redirect (so all UIs clear immediately)
    console.log('🗑️ Deleting parked call from database:', parkedCallId)
    const { error: deleteError } = await adminClient
      .from('parked_calls')
      .delete()
      .eq('id', parkedCallId)

    if (deleteError) {
      console.error('Error deleting parked call:', deleteError)
    } else {
      console.log('✅ Parked call deleted from database - all UIs should clear now')
    }

    // Delete active_calls entry since call is no longer parked (will ring to new agent)
    const { error: deleteActiveError } = await adminClient
      .from('active_calls')
      .delete()
      .eq('call_sid', pstnCallSid)

    if (deleteActiveError) {
      console.error('Warning: Failed to delete active_calls:', deleteActiveError)
    }

    console.log('Redirecting PSTN call to new agent:', newAgentId)

    // Redirect the PSTN call from conference to the new agent
    await twilioClient.calls(pstnCallSid).update({
      twiml: twiml,
    })

    console.log('Call redirected to new agent:', newAgentId)

    // Update the original call record in database
    if (parkedCall.call_id) {
      await adminClient
        .from('calls')
        .update({
          assigned_to: newAgentId,
          status: 'in-progress',
        })
        .eq('id', parkedCall.call_id)
    }

    console.log('✅ Call unparked successfully')

    return NextResponse.json({
      success: true,
      message: 'Call retrieved from parking',
      newAgentId: newAgentId,
    })
  } catch (error: any) {
    console.error('❌ Error unparking call:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to unpark call' },
      { status: 500 }
    )
  }
}

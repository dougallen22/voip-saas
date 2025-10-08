import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import twilio from 'twilio'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { callSid, userId, callerNumber, callId } = body

    if (!callSid || !userId || !callerNumber) {
      return NextResponse.json(
        { error: 'Missing required fields: callSid, userId, callerNumber' },
        { status: 400 }
      )
    }

    console.log('🚗 PARKING CALL:', { callSid, userId, callerNumber, callId })

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )

    // The callSid we receive is from the browser client (child call)
    // We need to get the parent call (PSTN caller)
    let call
    let pstnCallSid

    try {
      call = await twilioClient.calls(callSid).fetch()
      console.log('Fetched browser client call:', {
        sid: call.sid,
        parentCallSid: call.parentCallSid,
        direction: call.direction,
        from: call.from,
        to: call.to,
        status: call.status,
      })

      // The parent call is the PSTN caller
      if (!call.parentCallSid) {
        throw new Error('No parent call found - this may not be a client call')
      }

      pstnCallSid = call.parentCallSid
      console.log('PSTN parent call SID:', pstnCallSid)

      // Verify the parent call exists and is active
      const parentCall = await twilioClient.calls(pstnCallSid).fetch()
      console.log('PSTN parent call status:', parentCall.status)

      if (parentCall.status === 'completed' || parentCall.status === 'canceled') {
        throw new Error(`Parent call is already ${parentCall.status}`)
      }
    } catch (fetchError: any) {
      console.error('❌ Error fetching call:', fetchError)
      throw new Error(`Failed to fetch call: ${fetchError.message}`)
    }

    // Create a unique conference name for this parked call
    const conferenceName = `park-${pstnCallSid}-${Date.now()}`
    const holdMusicUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://8336d5b13c1c.ngrok-free.app'}/api/twilio/hold-music`
    const parkTwimlUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://8336d5b13c1c.ngrok-free.app'}/api/twilio/park-twiml?conference=${encodeURIComponent(conferenceName)}`

    console.log('Redirecting PSTN call to conference:', conferenceName)

    // Redirect the PSTN parent call to TwiML that will put it in a conference
    // Using a URL redirect instead of inline TwiML
    try {
      const updatedCall = await twilioClient.calls(pstnCallSid).update({
        url: parkTwimlUrl,
        method: 'POST',
      })

      console.log('✅ Call redirected to park TwiML:', {
        sid: updatedCall.sid,
        status: updatedCall.status,
        url: parkTwimlUrl,
      })
    } catch (updateError: any) {
      console.error('❌ Error updating call:', updateError)
      throw new Error(`Failed to redirect call: ${updateError.message}`)
    }

    // The conference will be created automatically when the call is redirected
    // We don't need to wait for it - Twilio will handle the conference creation
    console.log('✅ Call park initiated - conference will be created when call redirects')

    // Store in database
    // Note: We store the conference name but not the SIDs since the conference
    // hasn't been created yet. We'll update these later via webhook if needed.
    const { data: parkedCall, error: dbError } = await adminClient
      .from('parked_calls')
      .insert({
        call_id: callId,
        twilio_conference_sid: null, // Will be populated when conference is created
        twilio_participant_sid: pstnCallSid, // The PSTN call that will join
        parked_by_user_id: userId,
        caller_number: callerNumber,
        original_agent_id: userId,
        metadata: {
          conference_name: conferenceName,
          hold_music_url: holdMusicUrl,
          pstn_call_sid: pstnCallSid,
        },
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error(`Database error: ${dbError.message}`)
    }

    console.log('✅ Call parked successfully:', parkedCall.id)

    return NextResponse.json({
      success: true,
      parkedCallId: parkedCall.id,
      conferenceName: conferenceName,
      pstnCallSid: pstnCallSid,
    })
  } catch (error: any) {
    console.error('❌ Error parking call:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to park call' },
      { status: 500 }
    )
  }
}

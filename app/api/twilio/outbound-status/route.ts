import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import twilio from 'twilio'

const VoiceResponse = twilio.twiml.VoiceResponse

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const searchParams = new URL(request.url).searchParams
    const callId = searchParams.get('callId')

    const dialCallStatus = formData.get('DialCallStatus') as string
    const dialCallDuration = formData.get('DialCallDuration') as string
    const callSid = formData.get('CallSid') as string

    console.log('=== OUTBOUND CALL STATUS ===')
    console.log('Call ID:', callId)
    console.log('CallSid:', callSid)
    console.log('Dial Status:', dialCallStatus)
    console.log('Duration:', dialCallDuration)
    console.log('===========================')

    if (!callId) {
      console.error('❌ No call ID provided')
      return new NextResponse(new VoiceResponse().toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Map Twilio DialCallStatus to our database status
    let finalStatus = 'completed'
    if (dialCallStatus === 'busy') finalStatus = 'busy'
    else if (dialCallStatus === 'no-answer') finalStatus = 'no-answer'
    else if (dialCallStatus === 'failed') finalStatus = 'failed'
    else if (dialCallStatus === 'canceled') finalStatus = 'canceled'

    // Update call record with final status
    const { error: callError } = await adminClient
      .from('calls')
      .update({
        status: finalStatus,
        ended_at: new Date().toISOString(),
        duration: dialCallDuration ? parseInt(dialCallDuration) : null,
      })
      .eq('id', callId)

    if (callError) {
      console.error('❌ Failed to update call record:', callError)
    } else {
      console.log('✅ Call record updated with status:', finalStatus)
    }

    // Get the agent ID from the call record
    const { data: call } = await adminClient
      .from('calls')
      .select('answered_by_user_id')
      .eq('id', callId)
      .single()

    if (call?.answered_by_user_id) {
      // Clear agent's current_call_id to mark them as available again
      const { error: updateError } = await adminClient
        .from('voip_users')
        .update({
          current_call_id: null,
          current_call_phone_number: null,
          is_available: true
        })
        .eq('id', call.answered_by_user_id)

      if (updateError) {
        console.error('❌ Failed to clear agent call status:', updateError)
      } else {
        console.log('✅ Agent marked as available')
      }
    }

    // Return empty TwiML (call is complete)
    const twiml = new VoiceResponse()

    // If call failed, we could optionally say something to the agent
    if (finalStatus === 'busy') {
      twiml.say('The number you called is busy.')
    } else if (finalStatus === 'no-answer') {
      twiml.say('The call was not answered.')
    } else if (finalStatus === 'failed') {
      twiml.say('The call failed. Please try again.')
    }

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error: any) {
    console.error('❌ OUTBOUND STATUS ERROR:', error)
    console.error('Error stack:', error.stack)

    return new NextResponse(new VoiceResponse().toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  }
}

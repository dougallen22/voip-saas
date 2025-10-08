import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import twilio from 'twilio'

export async function POST(request: Request) {
  const twiml = new twilio.twiml.VoiceResponse()

  try {
    const formData = await request.formData()
    const dialCallStatus = formData.get('DialCallStatus') as string
    const callSid = formData.get('CallSid') as string

    console.log('📞 DIAL STATUS CALLBACK:', { dialCallStatus, callSid })

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (dialCallStatus === 'no-answer' || dialCallStatus === 'failed') {
      console.log('⚠️ All agents unavailable or declined - going to voicemail')
      twiml.say({ voice: 'alice' }, 'All agents are currently unavailable. Please leave a message after the beep.')
      twiml.record({
        timeout: 3,
        transcribe: true,
        maxLength: 120,
        transcribeCallback: `/api/twilio/transcription`
      })
      twiml.say({ voice: 'alice' }, 'Thank you for your message. Goodbye.')
      twiml.hangup()
    } else if (dialCallStatus === 'completed') {
      // Call was answered - connection is already established, do nothing
      console.log('✅ Call successfully connected to agent')
    } else if (dialCallStatus === 'busy') {
      console.log('⚠️ All agents busy')
      twiml.say({ voice: 'alice' }, 'All agents are currently busy. Please try again later.')
      twiml.hangup()
    } else if (dialCallStatus === 'canceled') {
      console.log('⚠️ Call canceled before answer - caller hung up')

      // Broadcast ring_cancel event to clear all agent UIs
      await adminClient.from('ring_events').insert({
        call_sid: callSid,
        agent_id: null,
        event_type: 'ring_cancel'
      })

      twiml.hangup()
    } else {
      console.log('⚠️ Unknown dial status:', dialCallStatus)
      twiml.say({ voice: 'alice' }, 'Unable to connect your call. Please try again.')
      twiml.hangup()
    }

    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (error: any) {
    console.error('❌ Error in dial-status:', error)

    // Fallback TwiML in case of error
    twiml.say({ voice: 'alice' }, 'An error occurred. Please try again later.')
    twiml.hangup()

    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    })
  }
}

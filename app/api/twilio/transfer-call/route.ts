import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import twilio from 'twilio'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { callSid, targetAgentId, callerNumber } = await request.json()

    console.log('🔄 TRANSFER CALL:', { callSid, targetAgentId, callerNumber })

    // 1. Get the browser client call to find parent PSTN call
    const call = await twilioClient.calls(callSid).fetch()
    const pstnCallSid = call.parentCallSid

    if (!pstnCallSid) {
      throw new Error('Could not find parent PSTN call')
    }

    console.log('Found PSTN call:', pstnCallSid)

    // 2. Verify PSTN call is still active
    const pstnCall = await twilioClient.calls(pstnCallSid).fetch()
    if (pstnCall.status === 'completed' || pstnCall.status === 'canceled') {
      throw new Error(`Call has already ended (${pstnCall.status})`)
    }

    // 3. Generate TwiML to ring the target agent
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Transferring your call now.</Say>
  <Dial timeout="30" callerId="${callerNumber}">
    <Client>${targetAgentId}</Client>
  </Dial>
  <Say>The agent could not be reached. Please hold.</Say>
  <Play loop="0">https://demo.twilio.com/docs/classic.mp3</Play>
</Response>`

    // 4. Redirect PSTN call to new agent
    await twilioClient.calls(pstnCallSid).update({
      twiml: twiml,
    })

    console.log('✅ Call transferred successfully')

    return NextResponse.json({
      success: true,
      pstnCallSid,
      targetAgentId
    })

  } catch (error: any) {
    console.error('❌ Transfer error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to transfer call' },
      { status: 500 }
    )
  }
}

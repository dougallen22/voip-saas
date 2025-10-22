import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import twilio from 'twilio'

const AccessToken = twilio.jwt.AccessToken
const VoiceGrant = AccessToken.VoiceGrant

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create an access token with 4 hour TTL
    // Token will expire after 4 hours, but tokenWillExpire event fires 10 seconds before
    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_API_KEY!,
      process.env.TWILIO_API_SECRET!,
      {
        identity: user.id,
        ttl: 14400 // 4 hours in seconds (4 * 60 * 60)
      }
    )

    // Create a Voice grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID!,
      incomingAllow: true,
    })

    token.addGrant(voiceGrant)

    console.log('✅ Generated Twilio access token for user:', user.id, '(TTL: 4 hours)')

    return NextResponse.json({
      token: token.toJwt(),
      identity: user.id,
    })
  } catch (error: any) {
    console.error('Error generating token:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

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

    // Validate required environment variables
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_API_KEY || !process.env.TWILIO_API_SECRET) {
      console.error('❌ Missing Twilio credentials in environment variables')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    if (!process.env.TWILIO_TWIML_APP_SID) {
      console.error('❌ Missing TWILIO_TWIML_APP_SID in environment variables')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Create an access token with 4 hour TTL
    // Token will expire after 4 hours, but tokenWillExpire event fires 30 seconds before
    const now = Math.floor(Date.now() / 1000)
    const ttl = 14400 // 4 hours in seconds
    const expiresAt = now + ttl

    const token = new AccessToken(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_API_KEY,
      process.env.TWILIO_API_SECRET,
      {
        identity: user.id,
        ttl: ttl
      }
    )

    // Create a Voice grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
      incomingAllow: true,
    })

    token.addGrant(voiceGrant)

    const jwt = token.toJwt()

    const issuedAt = new Date(now * 1000).toISOString()
    const expiresAtDate = new Date(expiresAt * 1000).toISOString()

    console.log('✅ Generated Twilio access token:', {
      user: user.id,
      ttl: '4 hours',
      issuedAt,
      expiresAt: expiresAtDate,
      accountSid: process.env.TWILIO_ACCOUNT_SID?.substring(0, 10) + '...'
    })

    return NextResponse.json({
      token: jwt,
      identity: user.id,
    })
  } catch (error: any) {
    console.error('❌ Error generating token:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

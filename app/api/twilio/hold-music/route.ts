import { NextResponse } from 'next/server'
import twilio from 'twilio'

const VoiceResponse = twilio.twiml.VoiceResponse

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const twiml = new VoiceResponse()

    // Play hold music in a loop
    // Using Twilio's built-in hold music
    twiml.play({
      loop: 0, // 0 = infinite loop
    }, 'http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3')

    // Fallback: redirect back to this endpoint to continue playing
    twiml.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://8336d5b13c1c.ngrok-free.app'}/api/twilio/hold-music`)

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error: any) {
    console.error('Error generating hold music TwiML:', error)

    // Return simple hold message as fallback
    const twiml = new VoiceResponse()
    twiml.say('Please continue to hold.')
    twiml.pause({ length: 10 })
    twiml.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://8336d5b13c1c.ngrok-free.app'}/api/twilio/hold-music`)

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  }
}

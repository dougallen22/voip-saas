import { NextResponse } from 'next/server'
import twilio from 'twilio'

const VoiceResponse = twilio.twiml.VoiceResponse

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST() {
  const twiml = new VoiceResponse()

  twiml.say({
    voice: 'alice',
    loop: 0
  }, 'All of our agents are currently assisting other customers. Please continue to hold.')

  twiml.play({
    loop: 5
  }, 'http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3')

  return new NextResponse(twiml.toString(), {
    status: 200,
    headers: {
      'Content-Type': 'text/xml',
    },
  })
}

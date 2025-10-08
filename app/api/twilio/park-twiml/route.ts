import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const conferenceName = searchParams.get('conference')

    if (!conferenceName) {
      return new NextResponse('Missing conference name', { status: 400 })
    }

    const holdMusicUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://8336d5b13c1c.ngrok-free.app'}/api/twilio/hold-music`

    console.log('🎵 Generating park TwiML for conference:', conferenceName)

    // Return TwiML that puts the call in a conference with hold music
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Your call is being placed on hold.</Say>
  <Dial>
    <Conference
      beep="false"
      waitUrl="${holdMusicUrl}"
      waitMethod="POST"
      startConferenceOnEnter="true"
      endConferenceOnExit="true"
    >${conferenceName}</Conference>
  </Dial>
</Response>`

    return new NextResponse(twiml, {
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error: any) {
    console.error('❌ Error generating park TwiML:', error)
    return new NextResponse(`Error: ${error.message}`, { status: 500 })
  }
}

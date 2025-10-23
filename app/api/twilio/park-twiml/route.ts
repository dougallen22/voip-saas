import { NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const conferenceName = searchParams.get('conference')

    if (!conferenceName) {
      return new NextResponse('Missing conference name', { status: 400 })
    }

    if (!process.env.NEXT_PUBLIC_APP_URL) {
      return new NextResponse('NEXT_PUBLIC_APP_URL environment variable is not set', { status: 500 })
    }

    const holdMusicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/hold-music`

    console.log('🎵 Generating park TwiML for conference:', conferenceName)

    const statusCallbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/parked-call-status`

    // Return TwiML that puts the call in a conference with hold music
    // action callback will fire when the Dial ends (caller hangs up from parking lot)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial action="${statusCallbackUrl}" method="POST">
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

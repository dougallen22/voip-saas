import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID?.substring(0, 10) + '...',
    twilioTwimlAppSid: process.env.TWILIO_TWIML_APP_SID,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasTwilioApiKey: !!process.env.TWILIO_API_KEY,
    hasTwilioApiSecret: !!process.env.TWILIO_API_SECRET,
  })
}

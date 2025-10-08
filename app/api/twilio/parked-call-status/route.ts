import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const callSid = formData.get('CallSid') as string
    const dialCallStatus = formData.get('DialCallStatus') as string
    const callStatus = formData.get('CallStatus') as string

    console.log('📞 Parked call status update:', {
      callSid,
      dialCallStatus,
      callStatus,
      allParams: Object.fromEntries(formData)
    })

    if (!callSid) {
      return NextResponse.json({ error: 'CallSid required' }, { status: 400 })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find the parked call by the PSTN call SID (twilio_participant_sid)
    const { data: parkedCalls } = await adminClient
      .from('parked_calls')
      .select('*')
      .eq('twilio_participant_sid', callSid)

    console.log('Found parked calls:', parkedCalls)

    // If call ended (completed, no-answer, failed, busy, canceled), remove from parking lot
    if (dialCallStatus === 'completed' || dialCallStatus === 'no-answer' ||
        dialCallStatus === 'failed' || dialCallStatus === 'busy' ||
        dialCallStatus === 'canceled' || callStatus === 'completed') {

      console.log('🗑️ Call ended - removing from parking lot')

      if (parkedCalls && parkedCalls.length > 0) {
        for (const parkedCall of parkedCalls) {
          await adminClient
            .from('parked_calls')
            .delete()
            .eq('id', parkedCall.id)

          console.log('✅ Removed parked call from database:', parkedCall.id)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ Error handling parked call status:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

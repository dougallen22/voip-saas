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
    const callDuration = formData.get('CallDuration') as string
    const from = formData.get('From') as string
    const to = formData.get('To') as string

    // Log EVERYTHING for debugging
    console.log('📞 ===== PARKED CALL STATUS WEBHOOK =====')
    console.log('CallSid:', callSid)
    console.log('DialCallStatus:', dialCallStatus)
    console.log('CallStatus:', callStatus)
    console.log('CallDuration:', callDuration)
    console.log('From:', from)
    console.log('To:', to)
    console.log('All Parameters:', Object.fromEntries(formData))
    console.log('==========================================')

    if (!callSid) {
      console.error('❌ No CallSid provided in webhook')
      return NextResponse.json({ error: 'CallSid required' }, { status: 400 })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Try multiple ways to find the parked call
    console.log('🔍 Searching for parked call...')

    // Method 1: Find by twilio_participant_sid
    const { data: parkedCallsByParticipant } = await adminClient
      .from('parked_calls')
      .select('*')
      .eq('twilio_participant_sid', callSid)

    console.log('Method 1 (twilio_participant_sid):', parkedCallsByParticipant?.length || 0, 'found')

    // Method 2: Find by twilio_conference_sid
    const { data: parkedCallsByConference } = await adminClient
      .from('parked_calls')
      .select('*')
      .eq('twilio_conference_sid', callSid)

    console.log('Method 2 (twilio_conference_sid):', parkedCallsByConference?.length || 0, 'found')

    // Combine results
    const allFound = [
      ...(parkedCallsByParticipant || []),
      ...(parkedCallsByConference || [])
    ]

    // Deduplicate by ID
    const parkedCalls = Array.from(
      new Map(allFound.map(call => [call.id, call])).values()
    )

    console.log('Total unique parked calls found:', parkedCalls.length)

    if (parkedCalls.length === 0) {
      console.warn('⚠️ No parked calls found for CallSid:', callSid)
      console.log('This might be normal if the call was already unparked or never parked')
    }

    // Delete on ANY Dial end (not just specific statuses)
    // This catches edge cases where Twilio sends unexpected status values
    console.log('🗑️ Dial ended - removing from parking lot (status:', dialCallStatus || callStatus, ')')

    if (parkedCalls && parkedCalls.length > 0) {
      for (const parkedCall of parkedCalls) {
        const { error: deleteError } = await adminClient
          .from('parked_calls')
          .delete()
          .eq('id', parkedCall.id)

        if (deleteError) {
          console.error('❌ Error deleting parked call:', parkedCall.id, deleteError)
        } else {
          console.log('✅ Deleted parked call:', parkedCall.id)
        }
      }
    }

    // Also delete from active_calls when parked caller hangs up
    const { error: deleteActiveError } = await adminClient
      .from('active_calls')
      .delete()
      .eq('call_sid', callSid)

    if (deleteActiveError) {
      console.error('⚠️ Warning: Failed to delete active_calls:', deleteActiveError)
    } else {
      console.log('✅ Deleted active_calls entry')
    }

    return NextResponse.json({
      success: true,
      deleted: parkedCalls.length,
      callSid: callSid
    })
  } catch (error: any) {
    console.error('❌ Error handling parked call status:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

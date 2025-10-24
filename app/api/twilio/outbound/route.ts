import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import twilio from 'twilio'
import { formatToE164, isValidPhoneNumber } from '@/lib/utils/phoneFormatter'

const VoiceResponse = twilio.twiml.VoiceResponse

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const callSid = formData.get('CallSid') as string
    const to = formData.get('To') as string
    const contactName = formData.get('contactName') as string
    const from = formData.get('From') as string // This is the agent's user ID (identity)

    console.log('=== OUTBOUND CALL REQUEST ===')
    console.log('CallSid:', callSid)
    console.log('To:', to)
    console.log('Contact Name:', contactName)
    console.log('Agent ID (From):', from)
    console.log('============================')

    if (!to) {
      console.error('❌ No destination phone number provided')
      const twiml = new VoiceResponse()
      twiml.say('No destination number provided. Please try again.')
      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    // Validate phone number
    if (!isValidPhoneNumber(to)) {
      console.error('❌ Invalid phone number format:', to)
      const twiml = new VoiceResponse()
      twiml.say('Invalid phone number format. Please check the number and try again.')
      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    // Format phone number to E.164
    let formattedTo: string
    try {
      formattedTo = formatToE164(to)
      console.log('📞 Formatted phone number:', formattedTo)
    } catch (error: any) {
      console.error('❌ Phone formatting error:', error.message)
      const twiml = new VoiceResponse()
      twiml.say('Unable to format phone number. Please try again.')
      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get agent's organization ID
    const { data: agent } = await adminClient
      .from('voip_users')
      .select('organization_id')
      .eq('id', from)
      .single()

    // Use agent's org ID, or fallback to default organization
    const organizationId = agent?.organization_id || '9abcaa0f-5e39-41f5-b269-2b5872720768'

    console.log('📊 Using organization_id:', organizationId)

    // Create call record in database
    const { data: callRecord, error: callError } = await adminClient
      .from('calls')
      .insert({
        organization_id: organizationId,
        from_number: process.env.TWILIO_PHONE_NUMBER || 'Unknown',
        to_number: formattedTo,
        answered_by_user_id: from, // The agent making the call
        assigned_to: from, // For compatibility with existing schema
        status: 'ringing',
        direction: 'outbound',
        twilio_call_sid: callSid,
        metadata: {
          contactName: contactName || 'Unknown',
          initiatedBy: from
        }
      })
      .select()
      .single()

    if (callError) {
      console.error('❌ Failed to create call record:', callError)
    } else {
      console.log('✅ Call record created:', callRecord?.id)

      // Increment outbound call counts for the agent (daily, weekly, monthly, yearly)
      try {
        console.log('📊 Incrementing outbound call counts for agent:', from)

        // First, get current counts
        const { data: currentUser } = await adminClient
          .from('voip_users')
          .select('today_outbound_calls, weekly_outbound_calls, monthly_outbound_calls, yearly_outbound_calls')
          .eq('id', from)
          .single()

        // Increment all outbound counters
        const { error: updateError } = await adminClient
          .from('voip_users')
          .update({
            today_outbound_calls: (currentUser?.today_outbound_calls || 0) + 1,
            weekly_outbound_calls: (currentUser?.weekly_outbound_calls || 0) + 1,
            monthly_outbound_calls: (currentUser?.monthly_outbound_calls || 0) + 1,
            yearly_outbound_calls: (currentUser?.yearly_outbound_calls || 0) + 1
          })
          .eq('id', from)

        if (updateError) {
          console.error('⚠️ Failed to increment outbound call counts:', updateError)
        } else {
          console.log('✅ Incremented outbound call counts (daily/weekly/monthly/yearly) for agent:', from)
        }
      } catch (countError) {
        console.error('⚠️ Error in count increment:', countError)
        // Don't fail the request if count increment fails
      }
    }

    // Update agent's current_call_id to mark them as on a call
    const { error: updateError } = await adminClient
      .from('voip_users')
      .update({
        current_call_id: callRecord?.id || null,
        current_call_phone_number: formattedTo,
        is_available: false
      })
      .eq('id', from)

    if (updateError) {
      console.error('❌ Failed to update agent call status:', updateError)
    } else {
      console.log('✅ Agent marked as on call')
    }

    // Generate TwiML to dial the number
    const twiml = new VoiceResponse()

    // Use Dial verb to connect to the destination number
    const dial = twiml.dial({
      callerId: process.env.TWILIO_PHONE_NUMBER || undefined, // Use your Twilio number as caller ID
      action: `/api/twilio/outbound-status?callId=${callRecord?.id}`, // Called when dial completes
      timeout: 30, // Ring for 30 seconds before giving up
    })

    // Add the destination number
    dial.number({
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallback: `/api/twilio/outbound-events?callId=${callRecord?.id}`,
    }, formattedTo)

    console.log('📤 Returning TwiML to dial:', formattedTo)

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error: any) {
    console.error('❌ OUTBOUND CALL ERROR:', error)
    console.error('Error stack:', error.stack)

    const twiml = new VoiceResponse()
    twiml.say('An error occurred while placing the call. Please try again later.')

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  }
}

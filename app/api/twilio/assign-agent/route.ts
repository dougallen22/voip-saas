import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import twilio from 'twilio'

const VoiceResponse = twilio.twiml.VoiceResponse

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const callSid = formData.get('CallSid') as string
    const from = formData.get('From') as string

    console.log('Assigning agent for call:', { callSid, from })

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find an available agent
    const { data: availableAgents } = await adminClient
      .from('voip_users')
      .select('*')
      .is('organization_id', null)
      .eq('is_available', true)
      .in('role', ['agent', 'super_admin'])
      .limit(1)

    const twiml = new VoiceResponse()

    if (!availableAgents || availableAgents.length === 0) {
      twiml.say({
        voice: 'alice'
      }, 'We are sorry, but all of our agents are currently busy. Please try again later.')
      twiml.hangup()

      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: {
          'Content-Type': 'text/xml',
        },
      })
    }

    const agent = availableAgents[0]

    // Create a call record in the database
    const { data: callRecord } = await adminClient
      .from('calls')
      .insert({
        from_number: from,
        to_number: process.env.TWILIO_PHONE_NUMBER || '',
        assigned_to: agent.id,
        status: 'ringing',
        direction: 'inbound',
        twilio_call_sid: callSid,
      })
      .select()
      .single()

    // Mark agent as unavailable
    await adminClient
      .from('voip_users')
      .update({ is_available: false })
      .eq('id', agent.id)

    // Get agent's auth info for phone number
    const { data: { users } } = await adminClient.auth.admin.listUsers()
    const agentAuth = users?.find(u => u.id === agent.id)
    const agentPhone = agentAuth?.user_metadata?.phone_number

    if (agentPhone) {
      // Dial the agent's phone
      const dial = twiml.dial({
        action: `/api/twilio/call-status?callId=${callRecord?.id}`,
        timeout: 30,
      })

      dial.number({
        statusCallbackEvent: ['answered', 'completed'],
        statusCallback: `/api/twilio/call-events?callId=${callRecord?.id}`,
      }, agentPhone)
    } else {
      // No phone number - use browser-based calling (we'll implement this next)
      twiml.say({
        voice: 'alice'
      }, 'Connecting you to an agent via our web application.')

      // For now, just acknowledge
      twiml.pause({ length: 2 })
      twiml.say('Please hold.')
    }

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error: any) {
    console.error('Error assigning agent:', error)

    const twiml = new VoiceResponse()
    twiml.say('We encountered an error connecting you to an agent. Please try again.')
    twiml.hangup()

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  }
}

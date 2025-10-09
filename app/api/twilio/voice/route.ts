import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import twilio from 'twilio'

const VoiceResponse = twilio.twiml.VoiceResponse

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const callSid = formData.get('CallSid') as string
    const from = formData.get('From') as string
    const to = formData.get('To') as string

    console.log('=== INCOMING CALL ===')
    console.log('CallSid:', callSid)
    console.log('From:', from)
    console.log('To:', to)
    console.log('====================')

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find ALL available agents (multi-agent simultaneous ring)
    const { data: availableAgents, error: agentError } = await adminClient
      .from('voip_users')
      .select('*')
      .is('organization_id', null)
      .eq('is_available', true)
      .in('role', ['agent', 'super_admin'])
      // ✅ Removed .limit(1) - now gets ALL available agents

    console.log('📞 INCOMING CALL - Available agents:', {
      count: availableAgents?.length || 0,
      agents: availableAgents?.map(a => ({ id: a.id, name: a.full_name })) || [],
      error: agentError,
      errorDetails: agentError ? JSON.stringify(agentError) : null
    })

    const twiml = new VoiceResponse()

    if (!availableAgents || availableAgents.length === 0) {
      console.log('NO AGENTS AVAILABLE - going to voicemail')
      twiml.say({
        voice: 'alice'
      }, 'We are sorry, but all of our agents are currently busy. Please leave a message after the beep.')
      twiml.record({
        timeout: 3,
        transcribe: true,
        maxLength: 120,
        transcribeCallback: `/api/twilio/transcription`
      })
      twiml.say({
        voice: 'alice'
      }, 'Thank you for your message. Goodbye.')
      twiml.hangup()

      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: {
          'Content-Type': 'text/xml',
        },
      })
    }

    // Create call claim record (pending state)
    const { error: claimError } = await adminClient
      .from('call_claims')
      .insert({
        call_sid: callSid,
        status: 'pending'
      })

    if (claimError) {
      console.error('Warning: Failed to create call claim:', claimError)
    }

    // Create a call record in the database (not assigned to anyone yet)
    const { data: callRecord, error: callError } = await adminClient
      .from('calls')
      .insert({
        from_number: from,
        to_number: to || process.env.TWILIO_PHONE_NUMBER || '',
        assigned_to: null, // Will be set when agent claims the call
        status: 'ringing',
        direction: 'inbound',
        twilio_call_sid: callSid,
      })
      .select()
      .single()

    console.log('Created call record:', callRecord)
    if (callError) {
      console.error('Call record error:', callError)
    }

    // Insert into active_calls table for instant state tracking
    // Status is 'ringing' - will be updated to 'active', 'parked', or 'transferring'
    for (const agent of availableAgents) {
      const { error: activeCallError } = await adminClient
        .from('active_calls')
        .insert({
          call_sid: callSid,
          agent_id: agent.id,
          caller_number: from,
          status: 'ringing'
        })

      if (activeCallError) {
        console.error(`Warning: Failed to create active_call for agent ${agent.id}:`, activeCallError)
      }
    }

    // Broadcast ring_start event to all available agents
    for (const agent of availableAgents) {
      const { error: ringError } = await adminClient
        .from('ring_events')
        .insert({
          call_sid: callSid,
          agent_id: agent.id,
          event_type: 'ring_start'
        })

      if (ringError) {
        console.error(`Warning: Failed to create ring event for agent ${agent.id}:`, ringError)
      }
    }

    // Dial ALL available agents simultaneously
    const dial = twiml.dial({
      timeout: 30,
      action: `/api/twilio/dial-status`,
      callerId: from, // Pass through caller ID
    })

    // Add each agent as a Client element - Twilio will ring all simultaneously
    availableAgents.forEach(agent => {
      dial.client(agent.id)
      console.log(`  🔔 Ringing agent: ${agent.full_name} (${agent.id})`)
    })

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error: any) {
    console.error('Error in voice webhook:', error)

    const twiml = new VoiceResponse()
    twiml.say('We are experiencing technical difficulties. Please try again later.')
    twiml.hangup()

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  }
}

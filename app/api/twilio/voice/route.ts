import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import twilio from 'twilio'

const VoiceResponse = twilio.twiml.VoiceResponse

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  console.log('🚨🚨🚨 /api/twilio/voice ENDPOINT HIT 🚨🚨🚨')
  console.log('Timestamp:', new Date().toISOString())

  try {
    console.log('📥 Parsing form data...')
    const formData = await request.formData()
    const callSid = formData.get('CallSid') as string
    const from = formData.get('From') as string
    const to = formData.get('To') as string

    console.log('=== INCOMING CALL ===')
    console.log('CallSid:', callSid)
    console.log('From:', from)
    console.log('To:', to)
    console.log('====================')

    console.log('🔐 Creating Supabase admin client...')
    console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('🔍 Querying for available agents...')
    console.log('Query: voip_users where is_available=true AND role IN (agent, super_admin)')

    // Find ALL available agents (multi-agent simultaneous ring)
    const { data: availableAgents, error: agentError } = await adminClient
      .from('voip_users')
      .select('*')
      .eq('is_available', true)
      .in('role', ['agent', 'super_admin'])

    console.log('📊 Query results:', {
      count: availableAgents?.length || 0,
      agents: availableAgents?.map(a => ({
        id: a.id,
        name: a.full_name,
        role: a.role,
        is_available: a.is_available,
        organization_id: a.organization_id
      })) || [],
      error: agentError,
      errorDetails: agentError ? JSON.stringify(agentError) : null
    })

    console.log('📞 INCOMING CALL - Available agents:', {
      count: availableAgents?.length || 0,
      agents: availableAgents?.map(a => ({ id: a.id, name: a.full_name })) || [],
      error: agentError,
      errorDetails: agentError ? JSON.stringify(agentError) : null
    })

    const twiml = new VoiceResponse()

    if (!availableAgents || availableAgents.length === 0) {
      console.log('❌❌❌ NO AGENTS AVAILABLE - going to voicemail ❌❌❌')
      console.log('Reason: availableAgents is', availableAgents)
      console.log('Length:', availableAgents?.length)

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

      console.log('📤 Returning voicemail TwiML:', twiml.toString())
      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: {
          'Content-Type': 'text/xml',
        },
      })
    }

    console.log('✅ Found available agents, proceeding with call setup...')

    // Create call claim record (pending state)
    console.log('📝 Creating call claim record...')
    const { error: claimError } = await adminClient
      .from('call_claims')
      .insert({
        call_sid: callSid,
        status: 'pending'
      })

    if (claimError) {
      console.error('⚠️ Warning: Failed to create call claim:', claimError)
    } else {
      console.log('✅ Call claim created')
    }

    // Get organization_id (use first available agent's org, or default org)
    const organizationId = availableAgents[0]?.organization_id || '9abcaa0f-5e39-41f5-b269-2b5872720768'
    console.log('🏢 Using organization_id:', organizationId)

    // Create a call record in the database (not assigned to anyone yet)
    console.log('💾 Creating call record in database...')
    console.log('Call record data:', {
      organization_id: organizationId,
      from_number: from,
      to_number: to || process.env.TWILIO_PHONE_NUMBER || '',
      assigned_to: null,
      status: 'ringing',
      direction: 'inbound',
      twilio_call_sid: callSid,
    })

    const { data: callRecord, error: callError } = await adminClient
      .from('calls')
      .insert({
        organization_id: organizationId,
        from_number: from,
        to_number: to || process.env.TWILIO_PHONE_NUMBER || '',
        assigned_to: null, // Will be set when agent claims the call
        status: 'ringing',
        direction: 'inbound',
        twilio_call_sid: callSid,
      })
      .select()
      .single()

    if (callError) {
      console.error('❌ FAILED to create call record:', callError)
      console.error('Error details:', JSON.stringify(callError, null, 2))
    } else {
      console.log('✅ Call record created successfully:', callRecord)
    }

    // Insert into active_calls table for instant state tracking
    // Status is 'ringing' - will be updated to 'active', 'parked', or 'transferring'
    console.log('📞 Creating active_calls records for each agent...')
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
        console.error(`❌ Failed to create active_call for agent ${agent.id}:`, activeCallError)
      } else {
        console.log(`✅ Created active_call for agent ${agent.full_name}`)
      }
    }

    // Broadcast ring_start event to all available agents
    console.log('🔔 Broadcasting ring_start events to all agents...')
    for (const agent of availableAgents) {
      const { error: ringError } = await adminClient
        .from('ring_events')
        .insert({
          call_sid: callSid,
          agent_id: agent.id,
          event_type: 'ring_start'
        })

      if (ringError) {
        console.error(`❌ Failed to create ring event for agent ${agent.id}:`, ringError)
      } else {
        console.log(`✅ Ring event sent to ${agent.full_name}`)
      }
    }

    // Dial ALL available agents simultaneously
    console.log('🎯 Creating TwiML Dial instruction...')
    const dial = twiml.dial({
      timeout: 30,
      action: `/api/twilio/dial-status`,
      callerId: from, // Pass through caller ID
    })

    // Add each agent as a Client element - Twilio will ring all simultaneously
    console.log('👥 Adding agents to Dial instruction:')
    availableAgents.forEach(agent => {
      dial.client(agent.id)
      console.log(`  🔔 Ringing agent: ${agent.full_name} (${agent.id})`)
    })

    const twimlString = twiml.toString()
    console.log('📤 Returning TwiML response:', twimlString)

    return new NextResponse(twimlString, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    })
  } catch (error: any) {
    console.error('❌❌❌ CRITICAL ERROR in voice webhook:', error)
    console.error('Error stack:', error.stack)

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

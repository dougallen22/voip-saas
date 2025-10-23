import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import twilio from 'twilio'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { agentId, fromNumber } = await request.json()

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get agent details including organization_id
    const { data: agent, error: agentError } = await adminClient
      .from('voip_users')
      .select('id, is_available, organization_id')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (!agent.is_available) {
      return NextResponse.json({ error: 'Agent is not available' }, { status: 400 })
    }

    // Use agent's org ID, or fallback to default organization
    const organizationId = agent.organization_id || '9abcaa0f-5e39-41f5-b269-2b5872720768'

    // Create call record in database
    const { data: call, error: callError } = await adminClient
      .from('calls')
      .insert({
        organization_id: organizationId,
        from_number: fromNumber || 'Admin',
        to_number: 'Agent',
        assigned_to: agentId,
        status: 'ringing',
        direction: 'outbound',
        twilio_call_sid: `INTERNAL-${Date.now()}`, // Placeholder for internal calls
      })
      .select()
      .single()

    if (callError) {
      return NextResponse.json({ error: callError.message }, { status: 500 })
    }

    // Update agent availability
    await adminClient
      .from('voip_users')
      .update({ is_available: false })
      .eq('id', agentId)

    // TODO: Integrate Twilio when we have phone numbers configured
    // For now, we'll just create the call record and use Supabase realtime

    return NextResponse.json({
      success: true,
      call: {
        id: call.id,
        status: call.status,
        agent_id: agentId,
      },
    })
  } catch (error: any) {
    console.error('Call initiation error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

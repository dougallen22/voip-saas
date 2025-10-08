import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { callId, agentId } = await request.json()

    if (!callId || !agentId) {
      return NextResponse.json(
        { error: 'Call ID and Agent ID are required' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Update call status to rejected
    const { data: call, error: callError } = await adminClient
      .from('calls')
      .update({
        status: 'no-answer',
        ended_at: new Date().toISOString(),
      })
      .eq('id', callId)
      .eq('assigned_to', agentId)
      .select()
      .single()

    if (callError) {
      return NextResponse.json({ error: callError.message }, { status: 500 })
    }

    // Set agent back to available
    await adminClient
      .from('voip_users')
      .update({ is_available: true })
      .eq('id', agentId)

    return NextResponse.json({
      success: true,
      call: {
        id: call.id,
        status: call.status,
      },
    })
  } catch (error: any) {
    console.error('Reject call error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

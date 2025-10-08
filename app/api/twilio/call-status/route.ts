import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const callId = searchParams.get('callId')

    const formData = await request.formData()
    const dialCallStatus = formData.get('DialCallStatus') as string
    const dialCallDuration = formData.get('DialCallDuration') as string

    console.log('Call status update:', {
      callId,
      dialCallStatus,
      dialCallDuration,
    })

    if (!callId) {
      return NextResponse.json({ error: 'Call ID required' }, { status: 400 })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get the call record
    const { data: call } = await adminClient
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single()

    if (!call) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    // Update call based on status
    const updates: any = {
      updated_at: new Date().toISOString(),
    }

    if (dialCallStatus === 'completed') {
      updates.status = 'completed'
      updates.ended_at = new Date().toISOString()
      if (dialCallDuration) {
        updates.duration = parseInt(dialCallDuration)
      }

      // Mark agent as available again
      await adminClient
        .from('voip_users')
        .update({ is_available: true })
        .eq('id', call.assigned_to)
    } else if (dialCallStatus === 'no-answer' || dialCallStatus === 'failed') {
      updates.status = 'no-answer'
      updates.ended_at = new Date().toISOString()

      // Mark agent as available again
      await adminClient
        .from('voip_users')
        .update({ is_available: true })
        .eq('id', call.assigned_to)
    } else if (dialCallStatus === 'busy') {
      updates.status = 'no-answer'
      updates.ended_at = new Date().toISOString()

      // Mark agent as available again
      await adminClient
        .from('voip_users')
        .update({ is_available: true })
        .eq('id', call.assigned_to)
    }

    await adminClient
      .from('calls')
      .update(updates)
      .eq('id', callId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating call status:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

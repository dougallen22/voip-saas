import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const callId = searchParams.get('callId')

    const formData = await request.formData()
    const callStatus = formData.get('CallStatus') as string
    const callDuration = formData.get('CallDuration') as string

    console.log('Call event:', {
      callId,
      callStatus,
      callDuration,
    })

    if (!callId) {
      return NextResponse.json({ error: 'Call ID required' }, { status: 400 })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const updates: any = {}

    if (callStatus === 'in-progress') {
      updates.status = 'in-progress'
      updates.started_at = new Date().toISOString()
    } else if (callStatus === 'completed') {
      updates.status = 'completed'
      updates.ended_at = new Date().toISOString()
      if (callDuration) {
        updates.duration = parseInt(callDuration)
      }
    }

    if (Object.keys(updates).length > 0) {
      await adminClient
        .from('calls')
        .update(updates)
        .eq('id', callId)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error processing call event:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

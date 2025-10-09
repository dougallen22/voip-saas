import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { callSid, agentId, action } = body

    if (!callSid || !agentId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: callSid, agentId, action' },
        { status: 400 }
      )
    }

    console.log('📥 update-user-call:', { callSid, agentId, action, timestamp: new Date().toISOString() })

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (action === 'start') {
      // Get the call record to get the call ID
      const { data: callRecord, error: callFetchError } = await adminClient
        .from('calls')
        .select('id')
        .eq('twilio_call_sid', callSid)
        .single()

      if (callFetchError || !callRecord) {
        console.error('❌ Failed to fetch call record:', callFetchError)
        return NextResponse.json({
          success: false,
          error: 'Call not found'
        }, { status: 404 })
      }

      const callId = callRecord.id

      // Update voip_users to set current_call_id
      const { error: updateUserError } = await adminClient
        .from('voip_users')
        .update({ current_call_id: callId })
        .eq('id', agentId)

      if (updateUserError) {
        console.error('❌ Failed to update user current_call_id:', updateUserError)
        return NextResponse.json({
          success: false,
          error: updateUserError.message
        }, { status: 500 })
      }

      // Also update calls table status to 'active' and assigned_to
      const { error: updateCallError } = await adminClient
        .from('calls')
        .update({
          assigned_to: agentId,
          status: 'active',
          answered_at: new Date().toISOString()
        })
        .eq('id', callId)

      if (updateCallError) {
        console.error('❌ Failed to update call status:', updateCallError)
      }

      console.log('✅ Database updated - current_call_id set for agent', { agentId, callId })

      return NextResponse.json({
        success: true,
        callId
      })

    } else if (action === 'end') {
      // Clear current_call_id for this agent
      const { error: updateUserError } = await adminClient
        .from('voip_users')
        .update({ current_call_id: null })
        .eq('id', agentId)

      if (updateUserError) {
        console.error('❌ Failed to clear user current_call_id:', updateUserError)
        return NextResponse.json({
          success: false,
          error: updateUserError.message
        }, { status: 500 })
      }

      // Update call status to 'completed'
      const { error: updateCallError } = await adminClient
        .from('calls')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString()
        })
        .eq('twilio_call_sid', callSid)

      if (updateCallError) {
        console.error('❌ Failed to update call status:', updateCallError)
      }

      console.log('✅ Database updated - current_call_id cleared for agent', { agentId, callSid })

      return NextResponse.json({
        success: true
      })
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "start" or "end"' },
        { status: 400 }
      )
    }

  } catch (error: any) {
    console.error('❌ Error in update-user-call:', error)
    return NextResponse.json({
      error: error.message || 'Failed to update user call'
    }, { status: 500 })
  }
}

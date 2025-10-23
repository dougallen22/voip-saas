import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const searchParams = new URL(request.url).searchParams
    const callId = searchParams.get('callId')

    const callStatus = formData.get('CallStatus') as string
    const callSid = formData.get('CallSid') as string
    const timestamp = formData.get('Timestamp') as string

    console.log('=== OUTBOUND CALL EVENT ===')
    console.log('Call ID:', callId)
    console.log('CallSid:', callSid)
    console.log('Status:', callStatus)
    console.log('Timestamp:', timestamp)
    console.log('==========================')

    if (!callId) {
      console.error('❌ No call ID provided')
      return NextResponse.json({ success: false, error: 'No call ID' }, { status: 400 })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Update call record based on status
    const updates: any = {}

    switch (callStatus) {
      case 'ringing':
        updates.status = 'ringing'
        console.log('📞 Call is ringing...')
        break

      case 'in-progress':
        updates.status = 'in-progress'
        updates.answered_at = new Date().toISOString()
        console.log('✅ Call answered and in progress')
        break

      case 'completed':
        updates.status = 'completed'
        updates.ended_at = new Date().toISOString()
        console.log('✅ Call completed')
        break

      case 'busy':
        updates.status = 'busy'
        updates.ended_at = new Date().toISOString()
        console.log('⚠️ Number is busy')
        break

      case 'no-answer':
        updates.status = 'no-answer'
        updates.ended_at = new Date().toISOString()
        console.log('⚠️ No answer')
        break

      case 'failed':
        updates.status = 'failed'
        updates.ended_at = new Date().toISOString()
        console.log('❌ Call failed')
        break

      case 'canceled':
        updates.status = 'canceled'
        updates.ended_at = new Date().toISOString()
        console.log('⚠️ Call canceled')
        break

      default:
        console.log('ℹ️ Unknown status:', callStatus)
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await adminClient
        .from('calls')
        .update(updates)
        .eq('id', callId)

      if (updateError) {
        console.error('❌ Failed to update call:', updateError)
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 })
      }

      console.log('✅ Call record updated successfully')
    }

    // If call is answered (in-progress), update agent's current_call_id
    if (callStatus === 'in-progress') {
      const { data: call } = await adminClient
        .from('calls')
        .select('answered_by_user_id')
        .eq('id', callId)
        .single()

      if (call?.answered_by_user_id) {
        await adminClient
          .from('voip_users')
          .update({
            current_call_id: callId
          })
          .eq('id', call.answered_by_user_id)

        console.log('✅ Agent current_call_id updated')
      }
    }

    // If call ended (completed, failed, busy, no-answer, canceled), clear agent's current_call_id
    if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(callStatus)) {
      const { data: call } = await adminClient
        .from('calls')
        .select('answered_by_user_id')
        .eq('id', callId)
        .single()

      if (call?.answered_by_user_id) {
        await adminClient
          .from('voip_users')
          .update({
            current_call_id: null,
            current_call_phone_number: null,
            is_available: true
          })
          .eq('id', call.answered_by_user_id)

        console.log('✅ Agent marked as available')
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('❌ OUTBOUND EVENTS ERROR:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

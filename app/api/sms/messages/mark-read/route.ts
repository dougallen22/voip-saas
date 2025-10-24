import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { conversation_id } = await request.json()

    // Validation
    if (!conversation_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: conversation_id' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: voipUser, error: voipUserError } = await supabase
      .from('voip_users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (voipUserError || !voipUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify conversation belongs to user's organization
    const { data: conversation, error: convError } = await supabase
      .from('sms_conversations')
      .select('id, organization_id')
      .eq('id', conversation_id)
      .eq('organization_id', voipUser.organization_id)
      .single()

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Mark all unread messages in this conversation as read
    const { error: updateMessagesError } = await supabase
      .from('sms_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversation_id)
      .is('read_at', null)

    if (updateMessagesError) {
      console.error('Error marking messages as read:', updateMessagesError)
      return NextResponse.json(
        { error: 'Failed to mark messages as read' },
        { status: 500 }
      )
    }

    // Reset unread count on conversation
    const { error: updateConvError } = await supabase
      .from('sms_conversations')
      .update({ unread_count: 0 })
      .eq('id', conversation_id)

    if (updateConvError) {
      console.error('Error updating conversation unread count:', updateConvError)
      return NextResponse.json(
        { error: 'Failed to update conversation' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('❌ Error in mark-read API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

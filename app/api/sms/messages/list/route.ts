import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const conversation_id = searchParams.get('conversation_id')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

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

    // Get messages (without join - more reliable)
    const { data: messages, error: messagesError } = await supabase
      .from('sms_messages')
      .select(`
        id,
        conversation_id,
        twilio_message_sid,
        direction,
        from_number,
        to_number,
        body,
        media_urls,
        status,
        error_code,
        error_message,
        num_segments,
        num_media,
        sent_by_user_id,
        sent_at,
        delivered_at,
        read_at,
        created_at
      `)
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (messagesError) {
      console.error('Error fetching messages:', messagesError)
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      )
    }

    // Format response (simplified - no sender info for now)
    const formattedMessages = (messages || []).map((msg: any) => ({
      id: msg.id,
      conversation_id: msg.conversation_id,
      twilio_message_sid: msg.twilio_message_sid,
      direction: msg.direction,
      from_number: msg.from_number,
      to_number: msg.to_number,
      body: msg.body,
      media_urls: msg.media_urls,
      status: msg.status,
      error_code: msg.error_code,
      error_message: msg.error_message,
      num_segments: msg.num_segments,
      num_media: msg.num_media,
      sent_at: msg.sent_at,
      delivered_at: msg.delivered_at,
      read_at: msg.read_at,
      created_at: msg.created_at,
      sender: null // Simplified - can add later if needed
    }))

    return NextResponse.json({
      messages: formattedMessages,
      total: formattedMessages.length,
      has_more: formattedMessages.length === limit
    })

  } catch (error: any) {
    console.error('❌ Error in messages list API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

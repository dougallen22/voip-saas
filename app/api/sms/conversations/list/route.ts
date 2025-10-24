import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: voipUser, error: voipUserError } = await supabase
      .from('voip_users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (voipUserError || !voipUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get conversations with contact details
    const { data: conversations, error: conversationsError } = await supabase
      .from('sms_conversations')
      .select(`
        id,
        contact_id,
        twilio_phone_number,
        contact_phone_number,
        last_message_at,
        last_message_preview,
        unread_count,
        is_archived,
        created_at,
        updated_at,
        contacts (
          id,
          first_name,
          last_name,
          business_name,
          phone,
          email
        )
      `)
      .eq('organization_id', voipUser.organization_id)
      .order('last_message_at', { ascending: false })

    if (conversationsError) {
      console.error('Error fetching conversations:', conversationsError)
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      )
    }

    // Format response with contact names
    const formattedConversations = (conversations || []).map((conv: any) => {
      const contact = conv.contacts
      const contactName = contact?.business_name ||
                         `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim() ||
                         'Unknown Contact'

      return {
        id: conv.id,
        contact_id: conv.contact_id,
        contact_name: contactName,
        contact_phone: conv.contact_phone_number,
        contact_email: contact?.email,
        last_message_at: conv.last_message_at,
        last_message_preview: conv.last_message_preview,
        unread_count: conv.unread_count,
        is_archived: conv.is_archived,
        created_at: conv.created_at,
        contact: {
          id: contact?.id,
          first_name: contact?.first_name,
          last_name: contact?.last_name,
          business_name: contact?.business_name,
          phone: contact?.phone,
          email: contact?.email
        }
      }
    })

    return NextResponse.json({
      conversations: formattedConversations
    })

  } catch (error: any) {
    console.error('❌ Error in conversations list API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

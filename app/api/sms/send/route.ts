import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import twilio from 'twilio'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { contact_id, message, media_urls } = body

    // Validation
    if (!contact_id || !message?.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: contact_id and message are required' },
        { status: 400 }
      )
    }

    // Message length validation (SMS limit)
    if (message.length > 1600) {
      return NextResponse.json(
        { error: 'Message too long. Maximum 1600 characters.' },
        { status: 400 }
      )
    }

    // Media URL validation (if provided)
    if (media_urls && media_urls.length > 10) {
      return NextResponse.json(
        { error: 'Too many media attachments. Maximum 10 images.' },
        { status: 400 }
      )
    }

    console.log('📤 Sending SMS:', { contact_id, messageLength: message.length, hasMedia: !!media_urls })

    // Initialize Supabase admin client
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get current user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization and Twilio credentials
    const { data: voipUser, error: voipUserError } = await adminClient
      .from('voip_users')
      .select('organization_id, role')
      .eq('id', user.id)
      .single()

    if (voipUserError || !voipUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: organization, error: orgError } = await adminClient
      .from('organizations')
      .select('id, name, twilio_number')
      .eq('id', voipUser.organization_id)
      .single()

    if (orgError || !organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Get contact details
    const { data: contact, error: contactError } = await adminClient
      .from('contacts')
      .select('id, first_name, last_name, business_name, phone, organization_id')
      .eq('id', contact_id)
      .eq('organization_id', voipUser.organization_id)
      .single()

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Normalize phone numbers to E.164 format
    const normalizePhone = (phone: string): string => {
      const digits = phone.replace(/\D/g, '')
      if (digits.length === 10) {
        return `+1${digits}`
      } else if (digits.length === 11 && digits[0] === '1') {
        return `+${digits}`
      }
      return phone.startsWith('+') ? phone : `+${digits}`
    }

    const fromNumber = normalizePhone(organization.twilio_number || process.env.TWILIO_PHONE_NUMBER!)
    const toNumber = normalizePhone(contact.phone)

    console.log('📞 Phone numbers:', { from: fromNumber, to: toNumber })

    // Find or create conversation
    let conversation
    const { data: existingConversation } = await adminClient
      .from('sms_conversations')
      .select('*')
      .eq('organization_id', voipUser.organization_id)
      .eq('contact_id', contact_id)
      .single()

    if (existingConversation) {
      conversation = existingConversation
      console.log('✅ Found existing conversation:', conversation.id)
    } else {
      // Create new conversation
      const { data: newConversation, error: createError } = await adminClient
        .from('sms_conversations')
        .insert({
          organization_id: voipUser.organization_id,
          contact_id: contact_id,
          twilio_phone_number: fromNumber,
          contact_phone_number: toNumber,
          last_message_at: new Date().toISOString(),
          last_message_preview: message.substring(0, 100),
          unread_count: 0
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating conversation:', createError)
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
      }

      conversation = newConversation
      console.log('✅ Created new conversation:', conversation.id)
    }

    // Initialize Twilio client
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )

    // Send SMS via Twilio
    console.log('📤 Sending to Twilio...', {
      from: fromNumber,
      to: toNumber,
      bodyLength: message.length,
      mediaCount: media_urls?.length || 0
    })

    const twilioMessage = await twilioClient.messages.create({
      from: fromNumber,
      to: toNumber,
      body: message,
      mediaUrl: media_urls || undefined,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/sms-status`
    })

    console.log('✅ Twilio message sent:', {
      sid: twilioMessage.sid,
      status: twilioMessage.status,
      price: twilioMessage.price
    })

    // Store message in database
    const { data: dbMessage, error: messageError } = await adminClient
      .from('sms_messages')
      .insert({
        conversation_id: conversation.id,
        organization_id: voipUser.organization_id,
        twilio_message_sid: twilioMessage.sid,
        direction: 'outbound',
        from_number: fromNumber,
        to_number: toNumber,
        body: message,
        media_urls: media_urls || [],
        status: twilioMessage.status || 'queued',
        num_segments: twilioMessage.numSegments || 1,
        num_media: media_urls?.length || 0,
        price: twilioMessage.price ? parseFloat(twilioMessage.price) : null,
        price_unit: twilioMessage.priceUnit || 'USD',
        sent_by_user_id: user.id,
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (messageError) {
      console.error('Error storing message:', messageError)
      // Message was sent to Twilio but failed to store in DB
      // This is OK - webhook will handle it
      console.warn('⚠️ Message sent but failed to store in DB. Webhook will handle it.')
    }

    console.log('✅ SMS sent successfully:', dbMessage?.id)

    return NextResponse.json({
      success: true,
      message: dbMessage || { id: twilioMessage.sid, status: twilioMessage.status },
      conversation_id: conversation.id
    })

  } catch (error: any) {
    console.error('❌ Error sending SMS:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send SMS' },
      { status: 500 }
    )
  }
}

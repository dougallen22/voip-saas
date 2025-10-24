import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import twilio from 'twilio'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Parse Twilio webhook body (URL-encoded)
    const formData = await request.formData()
    const webhookData = Object.fromEntries(formData)

    const {
      MessageSid,
      From,
      To,
      Body,
      NumMedia,
      MediaUrl0, MediaUrl1, MediaUrl2, MediaUrl3, MediaUrl4,
      MediaUrl5, MediaUrl6, MediaUrl7, MediaUrl8, MediaUrl9,
      SmsStatus,
      NumSegments,
      FromCity,
      FromState,
      FromCountry
    } = webhookData

    console.log('📥 Incoming SMS webhook:', {
      MessageSid,
      From,
      To,
      BodyLength: (Body as string)?.length || 0,
      NumMedia
    })

    // TODO: Validate Twilio signature for security
    // const twilioSignature = request.headers.get('x-twilio-signature')
    // const isValid = twilio.validateRequest(
    //   process.env.TWILIO_AUTH_TOKEN!,
    //   twilioSignature,
    //   url,
    //   params
    // )

    // Initialize Supabase admin client
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Normalize phone numbers
    const normalizePhone = (phone: string): string => {
      const digits = phone.replace(/\D/g, '')
      if (digits.length === 10) {
        return `+1${digits}`
      } else if (digits.length === 11 && digits[0] === '1') {
        return `+${digits}`
      }
      return phone.startsWith('+') ? phone : `+${digits}`
    }

    const fromNumber = normalizePhone(From as string)
    const toNumber = normalizePhone(To as string)

    // Collect media URLs
    const mediaUrls: string[] = []
    const numMediaAttachments = parseInt(NumMedia as string || '0')
    for (let i = 0; i < numMediaAttachments; i++) {
      const mediaUrl = webhookData[`MediaUrl${i}`]
      if (mediaUrl) {
        mediaUrls.push(mediaUrl as string)
      }
    }

    console.log('📞 Normalized numbers:', { from: fromNumber, to: toNumber })
    console.log('📎 Media attachments:', mediaUrls.length)

    // Find organization by Twilio number
    const { data: organization, error: orgError } = await adminClient
      .from('organizations')
      .select('id, name')
      .eq('twilio_number', toNumber)
      .single()

    if (orgError || !organization) {
      console.error('Organization not found for Twilio number:', toNumber)
      // Return 200 OK to Twilio anyway to avoid retries
      return new NextResponse('', { status: 200 })
    }

    console.log('✅ Found organization:', organization.name)

    // Find or create contact by phone number (last 10 digits matching)
    const incomingDigits = fromNumber.replace(/\D/g, '')
    const incomingLast10 = incomingDigits.slice(-10)

    // Get all contacts for this organization
    const { data: allContacts, error: contactsError } = await adminClient
      .from('contacts')
      .select('id, first_name, last_name, business_name, phone, organization_id')
      .eq('organization_id', organization.id)

    if (contactsError) {
      console.error('Error fetching contacts:', contactsError)
      return new NextResponse('', { status: 200 })
    }

    // Find matching contact by last 10 digits
    let contact = allContacts?.find(c => {
      const contactNormalized = c.phone.replace(/\D/g, '')
      const contactLast10 = contactNormalized.slice(-10)
      return contactLast10 === incomingLast10
    })

    // If contact not found, create a new one
    if (!contact) {
      console.log('📝 Creating new contact for:', fromNumber)

      const { data: newContact, error: createError } = await adminClient
        .from('contacts')
        .insert({
          organization_id: organization.id,
          first_name: 'Unknown',
          last_name: fromNumber,
          phone: fromNumber,
          email: null,
          business_name: null
        })
        .select()
        .single()

      if (createError || !newContact) {
        console.error('Error creating contact:', createError)
        return new NextResponse('', { status: 200 })
      }

      contact = newContact
      console.log('✅ Created new contact:', newContact.id)
    } else {
      console.log('✅ Found existing contact:', contact.id)
    }

    // Safety check (should never happen)
    if (!contact) {
      console.error('Contact is undefined after creation/lookup')
      return new NextResponse('', { status: 200 })
    }

    // Find or create conversation
    let conversation
    const { data: existingConversation } = await adminClient
      .from('sms_conversations')
      .select('*')
      .eq('organization_id', organization.id)
      .eq('contact_id', contact.id)
      .single()

    if (existingConversation) {
      conversation = existingConversation
      console.log('✅ Found existing conversation:', conversation.id)
    } else {
      // Create new conversation
      const { data: newConversation, error: createError } = await adminClient
        .from('sms_conversations')
        .insert({
          organization_id: organization.id,
          contact_id: contact.id,
          twilio_phone_number: toNumber,
          contact_phone_number: fromNumber,
          last_message_at: new Date().toISOString(),
          last_message_preview: (Body as string)?.substring(0, 100) || '[Media]',
          unread_count: 1
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating conversation:', createError)
        return new NextResponse('', { status: 200 })
      }

      conversation = newConversation
      console.log('✅ Created new conversation:', conversation.id)
    }

    // Store message in database
    const { data: message, error: messageError } = await adminClient
      .from('sms_messages')
      .insert({
        conversation_id: conversation.id,
        organization_id: organization.id,
        twilio_message_sid: MessageSid as string,
        direction: 'inbound',
        from_number: fromNumber,
        to_number: toNumber,
        body: (Body as string) || null,
        media_urls: mediaUrls,
        status: 'received',
        num_segments: parseInt(NumSegments as string || '1'),
        num_media: numMediaAttachments,
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (messageError) {
      console.error('Error storing message:', messageError)
      return new NextResponse('', { status: 200 })
    }

    console.log('✅ Message stored:', message.id)

    // Log event
    await adminClient
      .from('sms_message_events')
      .insert({
        message_id: message.id,
        event_type: 'received',
        status: 'received',
        twilio_data: {
          MessageSid,
          From,
          To,
          Body,
          NumMedia,
          SmsStatus,
          FromCity,
          FromState,
          FromCountry
        }
      })

    // Return 200 OK to Twilio (TwiML can be added here for auto-reply if needed)
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (error: any) {
    console.error('❌ Error processing incoming SMS:', error)
    // Return 200 OK to Twilio to avoid retries
    return new NextResponse('', { status: 200 })
  }
}

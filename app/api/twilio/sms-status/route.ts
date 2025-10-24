import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Parse Twilio status callback (URL-encoded)
    const formData = await request.formData()
    const webhookData = Object.fromEntries(formData)

    const {
      MessageSid,
      MessageStatus,
      ErrorCode,
      ErrorMessage,
      From,
      To,
      SmsStatus
    } = webhookData

    console.log('📊 SMS status update:', {
      MessageSid,
      MessageStatus: MessageStatus || SmsStatus,
      ErrorCode
    })

    // TODO: Validate Twilio signature for security

    // Initialize Supabase admin client
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const status = (MessageStatus || SmsStatus) as string

    // Update message status
    const updateData: any = {
      status: status.toLowerCase()
    }

    // Set timestamp based on status
    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString()
    } else if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString()
    }

    // Add error details if failed
    if (status === 'failed' || status === 'undelivered') {
      updateData.error_code = ErrorCode ? parseInt(ErrorCode as string) : null
      updateData.error_message = ErrorMessage || null
    }

    const { data: message, error: updateError } = await adminClient
      .from('sms_messages')
      .update(updateData)
      .eq('twilio_message_sid', MessageSid as string)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating message status:', updateError)
      return new NextResponse('', { status: 200 })
    }

    console.log('✅ Message status updated:', message.id, status)

    // Log event
    if (message) {
      await adminClient
        .from('sms_message_events')
        .insert({
          message_id: message.id,
          event_type: status.toLowerCase(),
          status: status.toLowerCase(),
          error_code: ErrorCode ? parseInt(ErrorCode as string) : null,
          error_message: ErrorMessage as string || null,
          twilio_data: {
            MessageSid,
            MessageStatus: MessageStatus || SmsStatus,
            ErrorCode,
            ErrorMessage,
            From,
            To
          }
        })
    }

    // Return 200 OK to Twilio
    return new NextResponse('', { status: 200 })

  } catch (error: any) {
    console.error('❌ Error processing SMS status update:', error)
    // Return 200 OK to Twilio to avoid retries
    return new NextResponse('', { status: 200 })
  }
}

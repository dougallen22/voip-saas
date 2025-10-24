import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization_id
    const { data: voipUser, error: voipUserError } = await supabase
      .from('voip_users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    if (voipUserError || !voipUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const contactId = params.id

    // Fetch contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single()

    if (contactError || !contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Verify contact belongs to user's organization
    if (contact.organization_id !== voipUser.organization_id) {
      return NextResponse.json({ error: 'Unauthorized to view this contact' }, { status: 403 })
    }

    // Normalize phone number for matching (remove +1, spaces, dashes)
    const normalizedPhone = contact.phone.replace(/[\s\-+]/g, '')

    console.log('📞 Fetching history for contact:', contact.id, 'Phone:', contact.phone, 'Normalized:', normalizedPhone)

    // Fetch all calls for this organization
    const { data: allCalls, error: callsError } = await supabase
      .from('calls')
      .select('*')
      .eq('organization_id', voipUser.organization_id)
      .order('created_at', { ascending: false })
      .limit(200) // Get more to filter

    if (callsError) {
      console.error('Error fetching calls:', callsError)
    }

    // Filter calls by matching phone numbers with normalization
    const callHistory = allCalls?.filter(call => {
      const normalizedFrom = call.from_number?.replace(/[\s\-+]/g, '') || ''
      const normalizedTo = call.to_number?.replace(/[\s\-+]/g, '') || ''

      // Try matching with and without leading 1
      const matchFrom = normalizedFrom === normalizedPhone ||
                       normalizedFrom === '1' + normalizedPhone ||
                       normalizedFrom.slice(1) === normalizedPhone
      const matchTo = normalizedTo === normalizedPhone ||
                     normalizedTo === '1' + normalizedPhone ||
                     normalizedTo.slice(1) === normalizedPhone

      return matchFrom || matchTo
    }).slice(0, 20) || []

    console.log('📞 Found', callHistory.length, 'calls')

    // Fetch SMS messages for this contact
    const { data: smsMessages, error: smsError } = await supabase
      .from('sms_messages')
      .select('*')
      .eq('conversation_id', contact.phone)
      .order('created_at', { ascending: false })
      .limit(50)

    if (smsError) {
      console.error('Error fetching SMS messages:', smsError)
    }

    console.log('📱 Found', smsMessages?.length || 0, 'SMS messages')

    return NextResponse.json({
      contact,
      callHistory: callHistory || [],
      smsHistory: smsMessages || []
    })

  } catch (error: any) {
    console.error('Error in contacts get API:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

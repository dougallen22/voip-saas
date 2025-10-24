import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

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

    // Normalize phone number to digits only
    const normalizedPhone = phone.replace(/\D/g, '')

    // Get last 10 digits (handles +1 prefix variations)
    const last10Digits = normalizedPhone.slice(-10)

    console.log('📞 Looking up contact:', {
      incomingPhone: phone,
      normalized: normalizedPhone,
      last10: last10Digits
    })

    // Query contacts in the same organization
    // Match on last 10 digits to handle different formats
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, business_name, phone')
      .eq('organization_id', voipUser.organization_id)

    if (contactsError) {
      console.error('Error querying contacts:', contactsError)
      return NextResponse.json({ error: 'Failed to lookup contact' }, { status: 500 })
    }

    // Find matching contact by comparing last 10 digits
    const matchingContact = contacts?.find(contact => {
      const contactNormalized = contact.phone.replace(/\D/g, '')
      const contactLast10 = contactNormalized.slice(-10)
      return contactLast10 === last10Digits
    })

    if (matchingContact) {
      console.log('✅ Contact found:', {
        name: `${matchingContact.first_name} ${matchingContact.last_name}`,
        business: matchingContact.business_name
      })

      return NextResponse.json({
        contact: {
          id: matchingContact.id,
          first_name: matchingContact.first_name,
          last_name: matchingContact.last_name,
          business_name: matchingContact.business_name,
          phone: matchingContact.phone
        }
      })
    }

    console.log('❌ No contact found for phone:', phone)
    return NextResponse.json({ contact: null })

  } catch (error: any) {
    console.error('Error in contact lookup:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

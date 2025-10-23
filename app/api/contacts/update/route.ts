import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Phone validation - allows various formats
const PHONE_REGEX = /^[\d\s\-\+\(\)\.]+$/

export async function PATCH(request: Request) {
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

    // Parse request body
    const body = await request.json()
    const {
      id,
      business_name,
      first_name,
      last_name,
      address,
      city,
      state,
      zip,
      phone,
      email
    } = body

    // Validate contact ID
    if (!id) {
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 })
    }

    // Check if contact exists and belongs to user's organization
    const { data: existingContact, error: fetchError } = await supabase
      .from('contacts')
      .select('id, organization_id')
      .eq('id', id)
      .single()

    if (fetchError || !existingContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    if (existingContact.organization_id !== voipUser.organization_id) {
      return NextResponse.json({ error: 'Unauthorized to update this contact' }, { status: 403 })
    }

    // Build update object with only provided fields
    const updates: any = {}

    if (first_name !== undefined) {
      if (!first_name?.trim()) {
        return NextResponse.json({ error: 'First name cannot be empty' }, { status: 400 })
      }
      updates.first_name = first_name.trim()
    }

    if (last_name !== undefined) {
      if (!last_name?.trim()) {
        return NextResponse.json({ error: 'Last name cannot be empty' }, { status: 400 })
      }
      updates.last_name = last_name.trim()
    }

    if (phone !== undefined) {
      if (!phone?.trim()) {
        return NextResponse.json({ error: 'Phone number cannot be empty' }, { status: 400 })
      }
      if (!PHONE_REGEX.test(phone.trim())) {
        return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
      }
      updates.phone = phone.trim()
    }

    if (email !== undefined) {
      if (email?.trim() && !EMAIL_REGEX.test(email.trim())) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
      updates.email = email?.trim() || null
    }

    if (business_name !== undefined) {
      updates.business_name = business_name?.trim() || null
    }

    if (address !== undefined) {
      updates.address = address?.trim() || null
    }

    if (city !== undefined) {
      updates.city = city?.trim() || null
    }

    if (state !== undefined) {
      if (state && state.length !== 2) {
        return NextResponse.json({ error: 'State must be 2 characters' }, { status: 400 })
      }
      updates.state = state?.trim().toUpperCase() || null
    }

    if (zip !== undefined) {
      if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
        return NextResponse.json({ error: 'Invalid ZIP code format (use 12345 or 12345-6789)' }, { status: 400 })
      }
      updates.zip = zip?.trim() || null
    }

    // Update contact
    const { data: contact, error: updateError } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating contact:', updateError)
      return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 })
    }

    return NextResponse.json({ contact })

  } catch (error: any) {
    console.error('Error in contacts update API:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

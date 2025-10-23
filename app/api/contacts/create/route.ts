import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Phone validation - allows various formats
const PHONE_REGEX = /^[\d\s\-\+\(\)\.]+$/

export async function POST(request: Request) {
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

    // Validate required fields
    if (!first_name?.trim()) {
      return NextResponse.json({ error: 'First name is required' }, { status: 400 })
    }

    if (!last_name?.trim()) {
      return NextResponse.json({ error: 'Last name is required' }, { status: 400 })
    }

    if (!phone?.trim()) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    // Validate phone format
    if (!PHONE_REGEX.test(phone.trim())) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
    }

    // Validate email if provided
    if (email?.trim() && !EMAIL_REGEX.test(email.trim())) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Validate state if provided (must be 2 characters)
    if (state && state.trim() && state.trim().length !== 2) {
      return NextResponse.json({ error: 'State must be 2 characters' }, { status: 400 })
    }

    // Validate ZIP if provided (5 or 9 digits)
    if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
      return NextResponse.json({ error: 'Invalid ZIP code format (use 12345 or 12345-6789)' }, { status: 400 })
    }

    // Prepare state value
    const stateValue = state && state.trim() ? state.trim().toUpperCase() : null

    // Create contact
    console.log('Creating contact with data:', {
      organization_id: voipUser.organization_id,
      business_name: business_name?.trim() || null,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      address: address?.trim() || null,
      city: city?.trim() || null,
      state: stateValue,
      zip: zip?.trim() || null,
      phone: phone.trim(),
      email: email?.trim() || null,
    })

    const { data: contact, error: createError } = await supabase
      .from('contacts')
      .insert({
        organization_id: voipUser.organization_id,
        business_name: business_name?.trim() || null,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: stateValue,
        zip: zip?.trim() || null,
        phone: phone.trim(),
        email: email?.trim() || null,
        created_by_user_id: user.id
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating contact:', createError)
      console.error('Full error details:', JSON.stringify(createError, null, 2))
      return NextResponse.json({
        error: 'Failed to create contact',
        details: createError.message,
        code: createError.code
      }, { status: 500 })
    }

    return NextResponse.json({ contact }, { status: 201 })

  } catch (error: any) {
    console.error('Error in contacts create API:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

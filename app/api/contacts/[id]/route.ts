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

    // Fetch call history for this contact
    const { data: callHistory, error: callHistoryError } = await supabase
      .from('calls')
      .select('*')
      .eq('organization_id', voipUser.organization_id)
      .or(`from_number.eq.${contact.phone},to_number.eq.${contact.phone}`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (callHistoryError) {
      console.error('Error fetching call history:', callHistoryError)
    }

    return NextResponse.json({
      contact,
      callHistory: callHistory || []
    })

  } catch (error: any) {
    console.error('Error in contacts get API:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

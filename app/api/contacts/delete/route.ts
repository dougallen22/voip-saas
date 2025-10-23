import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
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
    const { id } = body

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
      return NextResponse.json({ error: 'Unauthorized to delete this contact' }, { status: 403 })
    }

    // Delete contact
    const { error: deleteError } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting contact:', deleteError)
      return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Contact deleted successfully' })

  } catch (error: any) {
    console.error('Error in contacts delete API:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

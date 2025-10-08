import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is super admin
    const { data: voipUser } = await supabase
      .from('voip_users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!voipUser || voipUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get request body
    const { name } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Create organization
    const { data: organization, error } = await supabase
      .from('organizations')
      .insert({ name })
      .select()
      .single()

    if (error) {
      console.error('Error creating organization:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(organization, { status: 201 })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

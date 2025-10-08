import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  try {
    const { userId, is_available, full_name } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Update voip_users table
    const updates: any = {}
    if (typeof is_available === 'boolean') {
      updates.is_available = is_available
    }

    if (Object.keys(updates).length > 0) {
      const { data: voipUser, error: voipError } = await adminClient
        .from('voip_users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (voipError) {
        return NextResponse.json({ error: voipError.message }, { status: 500 })
      }

      if (!voipUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    }

    // Update auth user metadata if full_name provided
    if (full_name) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(
        userId,
        { user_metadata: { full_name } }
      )

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

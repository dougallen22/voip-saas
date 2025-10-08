import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check auth.users
    const { data: { users }, error: usersError } = await adminClient.auth.admin.listUsers()

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    const authUser = users?.find(u => u.email === email)

    if (!authUser) {
      return NextResponse.json({
        exists: false,
        message: 'User not found in auth.users',
        allUsers: users?.map(u => u.email)
      })
    }

    // Check voip_users
    const { data: voipUser, error: voipError } = await adminClient
      .from('voip_users')
      .select('*')
      .eq('id', authUser.id)
      .single()

    return NextResponse.json({
      exists: true,
      authUser: {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
      },
      voipUser: voipUser || null,
      voipError: voipError?.message || null
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

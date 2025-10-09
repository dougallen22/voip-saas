import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Disable all caching for this route
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get all SaaS users (organization_id IS NULL AND role = 'agent' OR 'super_admin')
    const { data: voipUsers, error: voipError } = await adminClient
      .from('voip_users')
      .select(`
        *,
        calls:current_call_id (
          from_number,
          answered_at
        )
      `)
      .is('organization_id', null)
      .in('role', ['agent', 'super_admin'])
      .order('created_at', { ascending: false })

    if (voipError) {
      return NextResponse.json({ error: voipError.message }, { status: 500 })
    }

    // Get auth user details for each voip_user
    const { data: { users }, error: authError } = await adminClient.auth.admin.listUsers()

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Merge auth and voip data
    const saasUsers = voipUsers.map(voipUser => {
      const authUser = users?.find(u => u.id === voipUser.id)
      const relatedCall = (voipUser as any).calls as { from_number?: string | null, answered_at?: string | null } | null
      const currentCallPhoneNumber =
        voipUser.current_call_phone_number ??
        relatedCall?.from_number ??
        null

      return {
        id: voipUser.id,
        email: authUser?.email || 'N/A',
        full_name: authUser?.user_metadata?.full_name || 'N/A',
        role: voipUser.role,
        is_available: voipUser.is_available,
        current_call_id: voipUser.current_call_id,
        current_call_phone_number: currentCallPhoneNumber,
        current_call_answered_at: relatedCall?.answered_at ?? null,
        created_at: voipUser.created_at,
      }
    })

    return NextResponse.json({ users: saasUsers })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

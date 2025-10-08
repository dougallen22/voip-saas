import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function DELETE(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    console.log('🗑️  DELETE AGENT REQUEST:', userId)

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Get current user info for safety checks
    const { data: userToDelete, error: fetchError } = await adminClient
      .from('voip_users')
      .select('role, is_available')
      .eq('id', userId)
      .single()

    if (fetchError) {
      console.error('❌ Error fetching user:', fetchError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 2. Safety check: Prevent deleting the last super admin
    if (userToDelete.role === 'super_admin') {
      const { data: superAdmins, error: countError } = await adminClient
        .from('voip_users')
        .select('id')
        .eq('role', 'super_admin')
        .is('organization_id', null)

      if (countError) {
        console.error('❌ Error counting super admins:', countError)
      } else if (superAdmins && superAdmins.length <= 1) {
        return NextResponse.json({
          error: 'Cannot delete the last super admin'
        }, { status: 400 })
      }
    }

    // 3. Check for active calls
    const { data: activeCalls, error: callsError } = await adminClient
      .from('calls')
      .select('id')
      .eq('answered_by_user_id', userId)
      .in('status', ['ringing', 'in-progress'])

    if (callsError) {
      console.error('❌ Error checking active calls:', callsError)
    } else if (activeCalls && activeCalls.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete agent with active calls. End all calls first.'
      }, { status: 400 })
    }

    // 4. Clean up parked calls by this user
    const { error: parkedError } = await adminClient
      .from('parked_calls')
      .delete()
      .eq('parked_by_user_id', userId)

    if (parkedError) {
      console.error('⚠️  Error cleaning up parked calls:', parkedError)
      // Continue anyway - don't fail the deletion
    } else {
      console.log('✅ Cleaned up parked calls')
    }

    // 5. Delete from voip_users FIRST (CASCADE doesn't always work)
    console.log('🗑️  Deleting from voip_users...')
    const { error: voipError } = await adminClient
      .from('voip_users')
      .delete()
      .eq('id', userId)

    if (voipError) {
      console.error('❌ Error deleting voip_users:', voipError)
      return NextResponse.json({
        error: `Failed to delete user from voip_users: ${voipError.message}`
      }, { status: 500 })
    }

    console.log('✅ Deleted from voip_users')

    // 6. Then delete from auth.users
    console.log('🗑️  Deleting from auth.users...')
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('❌ Error deleting auth user:', authError)
      return NextResponse.json({
        error: `Failed to delete user from auth: ${authError.message}`
      }, { status: 500 })
    }

    console.log('✅ User deleted successfully from both auth.users and voip_users')

    return NextResponse.json({
      success: true,
      message: 'Agent deleted successfully'
    })
  } catch (error: any) {
    console.error('❌ Unexpected error in delete agent:', error)
    return NextResponse.json({
      error: error.message || 'An unexpected error occurred'
    }, { status: 500 })
  }
}

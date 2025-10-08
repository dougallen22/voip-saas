import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Clean up orphaned voip_users records (users that exist in voip_users but not in auth.users)
 * This can happen if CASCADE constraints aren't working properly
 */
// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🧹 CLEANUP: Starting orphaned users cleanup...')

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Get all voip_users
    const { data: voipUsers, error: voipError } = await adminClient
      .from('voip_users')
      .select('id')

    if (voipError) {
      console.error('❌ Error fetching voip_users:', voipError)
      return NextResponse.json({ error: voipError.message }, { status: 500 })
    }

    if (!voipUsers || voipUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No voip_users found',
        orphaned: []
      })
    }

    console.log(`📊 Found ${voipUsers.length} voip_users records`)

    // 2. Get all auth users
    const { data: { users: authUsers }, error: authError } = await adminClient.auth.admin.listUsers()

    if (authError) {
      console.error('❌ Error fetching auth users:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    console.log(`📊 Found ${authUsers?.length || 0} auth.users records`)

    // 3. Find orphaned records (in voip_users but not in auth.users)
    const authUserIds = new Set(authUsers?.map(u => u.id) || [])
    const orphanedUsers = voipUsers.filter(vu => !authUserIds.has(vu.id))

    if (orphanedUsers.length === 0) {
      console.log('✅ No orphaned users found')
      return NextResponse.json({
        success: true,
        message: 'No orphaned users found',
        orphaned: []
      })
    }

    console.log(`⚠️  Found ${orphanedUsers.length} orphaned voip_users records`)
    console.log('Orphaned IDs:', orphanedUsers.map(u => u.id))

    // 4. Delete orphaned records
    const deletedIds: string[] = []
    const failedIds: string[] = []

    for (const orphan of orphanedUsers) {
      const { error: deleteError } = await adminClient
        .from('voip_users')
        .delete()
        .eq('id', orphan.id)

      if (deleteError) {
        console.error(`❌ Failed to delete orphaned user ${orphan.id}:`, deleteError)
        failedIds.push(orphan.id)
      } else {
        console.log(`✅ Deleted orphaned user ${orphan.id}`)
        deletedIds.push(orphan.id)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup complete: ${deletedIds.length} deleted, ${failedIds.length} failed`,
      orphaned: orphanedUsers.map(u => u.id),
      deleted: deletedIds,
      failed: failedIds
    })
  } catch (error: any) {
    console.error('❌ Unexpected error in cleanup:', error)
    return NextResponse.json({
      error: error.message || 'An unexpected error occurred'
    }, { status: 500 })
  }
}

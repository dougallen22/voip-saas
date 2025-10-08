import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch all parked calls
    const { data: parkedCalls, error } = await adminClient
      .from('parked_calls')
      .select('*')
      .order('parked_at', { ascending: true })

    if (error) {
      console.error('Error fetching parked calls:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      count: parkedCalls?.length || 0,
      parkedCalls: parkedCalls || []
    })
  } catch (error: any) {
    console.error('❌ Error in cleanup-parked-calls GET:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, parkedCallId } = body

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    if (action === 'delete_one' && parkedCallId) {
      // Delete specific parked call
      const { error } = await adminClient
        .from('parked_calls')
        .delete()
        .eq('id', parkedCallId)

      if (error) {
        console.error('Error deleting parked call:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      console.log('✅ Deleted parked call:', parkedCallId)
      return NextResponse.json({
        success: true,
        message: `Deleted parked call ${parkedCallId}`
      })
    }

    else if (action === 'delete_all') {
      // Delete ALL parked calls
      const { error } = await adminClient
        .from('parked_calls')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

      if (error) {
        console.error('Error deleting all parked calls:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      console.log('✅ Deleted ALL parked calls')
      return NextResponse.json({
        success: true,
        message: 'Deleted all parked calls'
      })
    }

    else if (action === 'delete_old') {
      // Delete parked calls older than 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

      const { data: oldCalls, error: selectError } = await adminClient
        .from('parked_calls')
        .select('id')
        .lt('parked_at', thirtyMinutesAgo)

      if (selectError) {
        console.error('Error finding old parked calls:', selectError)
        return NextResponse.json({ error: selectError.message }, { status: 500 })
      }

      if (oldCalls && oldCalls.length > 0) {
        const { error: deleteError } = await adminClient
          .from('parked_calls')
          .delete()
          .lt('parked_at', thirtyMinutesAgo)

        if (deleteError) {
          console.error('Error deleting old parked calls:', deleteError)
          return NextResponse.json({ error: deleteError.message }, { status: 500 })
        }

        console.log(`✅ Deleted ${oldCalls.length} old parked calls`)
        return NextResponse.json({
          success: true,
          message: `Deleted ${oldCalls.length} parked calls older than 30 minutes`
        })
      } else {
        return NextResponse.json({
          success: true,
          message: 'No old parked calls to delete'
        })
      }
    }

    else {
      return NextResponse.json({ error: 'Invalid action. Use: delete_one, delete_all, or delete_old' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('❌ Error in cleanup-parked-calls POST:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    console.log('DEBUG: Querying database for user:', userId)

    // Direct query - no filters, just get the user
    const { data: user, error } = await adminClient
      .from('voip_users')
      .select('*')
      .eq('id', userId)
      .single()

    console.log('DEBUG: Raw database response:', { user, error })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      raw_database_value: user,
      is_available: user?.is_available,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.log('DEBUG: Exception:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

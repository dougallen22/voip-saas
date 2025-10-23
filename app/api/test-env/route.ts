import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Check if env vars exist
    const hasUrl = !!supabaseUrl
    const hasKey = !!supabaseKey
    const urlLength = supabaseUrl?.length || 0
    const keyLength = supabaseKey?.length || 0

    // Try to create client and query
    let agentCount = 0
    let queryError = null

    if (hasUrl && hasKey) {
      try {
        const adminClient = createAdminClient(supabaseUrl, supabaseKey)

        const { data: availableAgents, error } = await adminClient
          .from('voip_users')
          .select('*')
          .eq('is_available', true)
          .in('role', ['agent', 'super_admin'])

        agentCount = availableAgents?.length || 0
        queryError = error?.message || null
      } catch (err: any) {
        queryError = err.message
      }
    }

    return NextResponse.json({
      environment: {
        hasSupabaseUrl: hasUrl,
        hasSupabaseKey: hasKey,
        urlLength,
        keyLength,
        urlStart: supabaseUrl?.substring(0, 20),
        keyStart: supabaseKey?.substring(0, 20),
      },
      query: {
        availableAgents: agentCount,
        error: queryError,
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = await createClient()

    // Get all auth users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    const results = []

    for (const user of users || []) {
      // Check if voip_user exists
      const { data: existingUser } = await supabase
        .from('voip_users')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!existingUser) {
        // Create voip_user record
        const { error: insertError } = await supabase
          .from('voip_users')
          .insert({
            id: user.id,
            role: 'agent',
            is_available: false,
          })

        if (insertError) {
          results.push({ user: user.email, error: insertError.message })
        } else {
          results.push({ user: user.email, status: 'created' })
        }
      } else {
        results.push({ user: user.email, status: 'already exists' })
      }
    }

    return NextResponse.json({ results })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

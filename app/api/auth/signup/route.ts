import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, password, fullName } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // User will be created in voip_users via database trigger
    return NextResponse.json({
      user: data.user,
      message: 'Account created successfully',
    })
  } catch (error: any) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

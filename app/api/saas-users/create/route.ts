import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, password, fullName } = await request.json()

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Email, password, and full name are required' },
        { status: 400 }
      )
    }

    console.log('👤 CREATE AGENT REQUEST:', email)

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if user already exists in auth
    const { data: { users: existingUsers } } = await adminClient.auth.admin.listUsers()
    const existingAuthUser = existingUsers?.find(u => u.email === email)

    let userId: string
    let authData: any = null

    if (existingAuthUser) {
      console.log('⚠️  Auth user already exists:', existingAuthUser.id)

      // User exists in auth, check if they have voip_users record
      const { data: existingVoipUser } = await adminClient
        .from('voip_users')
        .select('id')
        .eq('id', existingAuthUser.id)
        .single()

      if (existingVoipUser) {
        return NextResponse.json(
          { error: 'User already exists' },
          { status: 400 }
        )
      }

      // Auth user exists but no voip_users record - create it
      userId = existingAuthUser.id
      console.log('📝 Creating voip_users record for existing auth user')
    } else {
      // Check for orphaned voip_users record first
      const { data: orphanedVoipUsers } = await adminClient
        .from('voip_users')
        .select('id')
        .is('organization_id', null)

      console.log(`🔍 Checking for orphaned records...`)

      // Create new user in auth.users
      const { data: newAuthData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
        },
      })

      if (authError) {
        console.error('❌ Error creating auth user:', authError)
        return NextResponse.json({ error: authError.message }, { status: 500 })
      }

      authData = newAuthData
      userId = newAuthData.user.id
      console.log('✅ Created new auth user:', userId)
    }

    // Create SaaS user in voip_users (organization_id = null)
    console.log('📝 Inserting into voip_users...')
    const { data: voipUser, error: voipError } = await adminClient
      .from('voip_users')
      .insert({
        id: userId,
        organization_id: null, // SaaS user
        role: 'agent',
        is_available: false,
      })
      .select()
      .single()

    if (voipError) {
      console.error('❌ Error creating voip_users record:', voipError)

      // Check if this is an orphaned record issue
      if (voipError.message?.includes('duplicate key') || voipError.code === '23505') {
        // Try to clean up the orphaned record
        console.log('🧹 Attempting to clean up orphaned record...')
        const { error: deleteError } = await adminClient
          .from('voip_users')
          .delete()
          .eq('id', userId)

        if (deleteError) {
          console.error('❌ Failed to delete orphaned record:', deleteError)
          return NextResponse.json({
            error: 'Orphaned record exists. Please run cleanup: POST /api/admin/cleanup-orphaned-users'
          }, { status: 500 })
        }

        // Try insert again
        console.log('🔄 Retrying voip_users insert...')
        const { data: retryVoipUser, error: retryError } = await adminClient
          .from('voip_users')
          .insert({
            id: userId,
            organization_id: null,
            role: 'agent',
            is_available: false,
          })
          .select()
          .single()

        if (retryError) {
          console.error('❌ Retry failed:', retryError)
          return NextResponse.json({ error: retryError.message }, { status: 500 })
        }

        console.log('✅ Successfully created voip_users record after cleanup')

        return NextResponse.json({
          success: true,
          user: {
            id: userId,
            email: email,
            full_name: fullName,
            role: retryVoipUser.role,
            is_available: retryVoipUser.is_available,
          },
        })
      }

      return NextResponse.json({ error: voipError.message }, { status: 500 })
    }

    console.log('✅ Agent created successfully')

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: email,
        full_name: fullName,
        role: voipUser.role,
        is_available: voipUser.is_available,
      },
    })
  } catch (error: any) {
    console.error('❌ Unexpected error creating agent:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

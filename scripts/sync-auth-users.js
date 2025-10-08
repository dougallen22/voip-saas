#!/usr/bin/env node

/**
 * Sync script to ensure all auth.users have corresponding voip_users records
 * Run this after deployment to fix missing user profiles
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function syncUsers() {
  console.log('🔍 Fetching all auth users...')

  // Get all auth users
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers()

  if (authError) {
    console.error('❌ Error fetching auth users:', authError)
    process.exit(1)
  }

  console.log(`✅ Found ${users.length} auth users`)

  // Get all voip_users
  const { data: voipUsers, error: voipError } = await supabase
    .from('voip_users')
    .select('id, role')

  if (voipError) {
    console.error('❌ Error fetching voip_users:', voipError)
    process.exit(1)
  }

  console.log(`✅ Found ${voipUsers.length} voip_users`)

  const voipUserIds = new Set(voipUsers.map(u => u.id))

  // Find users missing from voip_users
  const missingUsers = users.filter(u => !voipUserIds.has(u.id))

  if (missingUsers.length === 0) {
    console.log('✅ All auth users have voip_users records!')
    return
  }

  console.log(`\n⚠️  Found ${missingUsers.length} users missing voip_users records:`)

  for (const user of missingUsers) {
    console.log(`\n📧 ${user.email}`)
    console.log(`   ID: ${user.id}`)

    // Determine role based on email
    const isSuperAdmin = user.email === 'dougallen22@icloud.com'
    const role = isSuperAdmin ? 'super_admin' : 'agent'

    console.log(`   Creating voip_users record with role: ${role}`)

    const { error: insertError } = await supabase
      .from('voip_users')
      .insert({
        id: user.id,
        organization_id: null,
        role: role,
        is_available: false
      })

    if (insertError) {
      console.error(`   ❌ Error creating voip_users record:`, insertError)
    } else {
      console.log(`   ✅ Created voip_users record`)
    }
  }

  console.log('\n✅ Sync complete!')
}

syncUsers().catch(console.error)

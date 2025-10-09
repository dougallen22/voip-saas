const { createClient } = require('@supabase/supabase-js')

// Check if the RLS policy allows authenticated users
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function diagnose() {
  console.log('🔍 Testing realtime with authenticated user...\n')

  // First, check if we can even SELECT from voip_users without auth
  console.log('1. Testing SELECT without auth...')
  const { data: unauthData, error: unauthError } = await anonClient
    .from('voip_users')
    .select('id')
    .limit(1)

  if (unauthError) {
    console.log('❌ Cannot SELECT without auth:', unauthError.message)
  } else {
    console.log('✅ Can SELECT without auth')
  }

  // Try to sign in as Doug
  console.log('\n2. Attempting to authenticate...')

  // We need actual credentials here - let's just test if RLS allows anon role
  console.log('\n3. Checking RLS policies...')

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: policies } = await serviceClient.rpc('exec_sql', {
    sql: `
      SELECT
        tablename,
        policyname,
        roles,
        cmd
      FROM pg_policies
      WHERE tablename = 'voip_users'
      ORDER BY policyname;
    `
  })

  console.log('RLS Policies on voip_users:')
  console.log(JSON.stringify(policies, null, 2))

  console.log('\n4. The issue: Supabase Realtime requires EITHER:')
  console.log('   a) RLS disabled on the table, OR')
  console.log('   b) A policy that grants SELECT to the role making the subscription')
  console.log('\nIf the frontend uses anon key and is NOT authenticated,')
  console.log('we need a policy for "anon" role, NOT "authenticated" role.')

  process.exit(0)
}

diagnose()

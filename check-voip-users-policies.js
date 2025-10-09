const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkPolicies() {
  console.log('🔍 Checking RLS policies for voip_users table...\n')

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT
        policyname,
        cmd,
        roles::text[],
        qual,
        with_check
      FROM pg_policies
      WHERE tablename = 'voip_users';
    `
  })

  if (error) {
    console.error('❌ Error:', error)

    // Try alternative method
    console.log('\n📋 Checking if RLS is enabled...')
    const { data: rlsData, error: rlsError } = await supabase.rpc('exec_sql', {
      sql: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'voip_users';`
    })

    if (rlsError) {
      console.error('❌ RLS check error:', rlsError)
    } else {
      console.log('RLS data:', rlsData)
    }
    return
  }

  console.log('Policies:', JSON.stringify(data, null, 2))
}

checkPolicies().then(() => process.exit(0))

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkRealtimeConfig() {
  console.log('🔍 Checking Supabase Realtime configuration...\n')

  // Check if realtime is enabled by trying to subscribe
  console.log('📡 Testing realtime subscription to voip_users...')

  const channel = supabase
    .channel('test-realtime-check')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'voip_users',
      },
      (payload) => {
        console.log('✅ REALTIME WORKS! Event received:', payload)
      }
    )
    .subscribe((status, err) => {
      console.log('Subscription status:', status)
      if (err) {
        console.error('❌ Subscription error:', err)
      }
    })

  // Wait for subscription
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Get a user to test with
  const { data: users } = await supabase
    .from('voip_users')
    .select('id')
    .limit(1)

  if (!users || users.length === 0) {
    console.error('❌ No users found')
    process.exit(1)
  }

  const userId = users[0].id

  // Make a test update
  console.log('\n🔄 Making test update to trigger realtime event...')
  const { error } = await supabase
    .from('voip_users')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) {
    console.error('❌ Update failed:', error)
  } else {
    console.log('✅ Update successful')
  }

  // Wait for event
  console.log('⏳ Waiting 5 seconds for realtime event...')
  await new Promise(resolve => setTimeout(resolve, 5000))

  console.log('\n📋 If you saw "REALTIME WORKS!" above, then realtime is configured correctly.')
  console.log('If not, realtime is NOT enabled for the voip_users table.\n')

  process.exit(0)
}

checkRealtimeConfig()

const { createClient } = require('@supabase/supabase-js')

// Create TWO clients - one with service role, one with anon (like the frontend)
const serviceClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function diagnose() {
  console.log('🔍 Diagnosing realtime subscriptions...\n')

  // Subscribe with ANON key (like the frontend does)
  console.log('📡 Setting up ANON subscription (simulating frontend)...')

  let anonEventReceived = false

  const anonChannel = anonClient
    .channel('test-anon-voip-users')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'voip_users',
      },
      (payload) => {
        console.log('\n✅ ANON CLIENT RECEIVED EVENT!')
        console.log('Event:', payload.eventType)
        console.log('New row:', payload.new)
        anonEventReceived = true
      }
    )
    .subscribe((status, err) => {
      console.log('Anon subscription status:', status)
      if (err) {
        console.error('❌ Anon subscription error:', err)
      }
    })

  // Wait for subscription
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Get a user
  const { data: users } = await serviceClient
    .from('voip_users')
    .select('id')
    .eq('role', 'super_admin')
    .single()

  if (!users) {
    console.error('❌ No users found')
    process.exit(1)
  }

  const userId = users.id

  // Make an update
  console.log('\n🔄 Making test update to voip_users...')
  const { error } = await serviceClient
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

  if (anonEventReceived) {
    console.log('\n✅ SUCCESS! ANON client CAN receive realtime events!')
    console.log('The frontend SHOULD be receiving events.')
  } else {
    console.log('\n❌ FAILURE! ANON client did NOT receive realtime event!')
    console.log('This is why Rhonda\'s browser doesn\'t see updates.')
    console.log('\nPossible causes:')
    console.log('1. Realtime not enabled for voip_users table in Supabase Dashboard')
    console.log('2. RLS policies blocking realtime events for authenticated users')
    console.log('3. Realtime disabled at the project level')
  }

  await anonClient.removeChannel(anonChannel)
  process.exit(0)
}

diagnose()

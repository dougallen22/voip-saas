const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testRealtimeUpdate() {
  console.log('🧪 Testing realtime update flow...\n')

  // Get a user
  const { data: users, error: usersError } = await supabase
    .from('voip_users')
    .select('*')
    .limit(1)

  if (usersError || !users || users.length === 0) {
    console.error('❌ Could not fetch user:', usersError)
    return
  }

  const testUser = users[0]
  console.log('📋 Test user:', { id: testUser.id, role: testUser.role })

  // Subscribe to changes
  console.log('\n📡 Setting up realtime subscription...')
  const channel = supabase
    .channel('test-voip-users-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'voip_users',
      },
      (payload) => {
        console.log('\n✅ REALTIME EVENT RECEIVED:')
        console.log('Event type:', payload.eventType)
        console.log('New row:', JSON.stringify(payload.new, null, 2))
        console.log('Old row:', JSON.stringify(payload.old, null, 2))
      }
    )
    .subscribe((status) => {
      console.log('Subscription status:', status)
    })

  // Wait for subscription to be ready
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Simulate answering a call - UPDATE current_call_id
  console.log('\n🔄 Simulating call answer - updating voip_users...')
  const { error: updateError } = await supabase
    .from('voip_users')
    .update({
      current_call_id: 'test-call-' + Date.now(),
      current_call_phone_number: '+15551234567',
      current_call_answered_at: new Date().toISOString()
    })
    .eq('id', testUser.id)

  if (updateError) {
    console.error('❌ Update failed:', updateError)
  } else {
    console.log('✅ Database updated successfully!')
  }

  // Wait for realtime event
  console.log('\n⏳ Waiting 5 seconds for realtime event...')
  await new Promise(resolve => setTimeout(resolve, 5000))

  // Clean up - set back to null
  console.log('\n🧹 Cleaning up - clearing current_call_id...')
  await supabase
    .from('voip_users')
    .update({
      current_call_id: null,
      current_call_phone_number: null,
      current_call_answered_at: null
    })
    .eq('id', testUser.id)

  // Wait for cleanup event
  await new Promise(resolve => setTimeout(resolve, 2000))

  console.log('\n✅ Test complete!')
  process.exit(0)
}

testRealtimeUpdate()

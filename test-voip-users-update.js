const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testVoipUsersUpdate() {
  console.log('🧪 Testing voip_users update with current_call_id...\n')

  // Get Doug's user
  const { data: users, error: usersError } = await supabase
    .from('voip_users')
    .select('*')
    .eq('role', 'super_admin')
    .single()

  if (usersError || !users) {
    console.error('❌ Could not fetch user:', usersError)
    return
  }

  const dougId = users.id
  console.log('📋 Doug\'s user ID:', dougId)

  // Simulate answering a call - set current_call_id to a test UUID
  console.log('\n🔄 Simulating call answer - setting current_call_id...')

  // First, create a test call record to get a valid UUID
  const { data: testCall, error: callError } = await supabase
    .from('calls')
    .insert({
      from_number: '+15551234567',
      to_number: '+15559876543',
      status: 'in-progress',
      assigned_to: dougId,
      answered_at: new Date().toISOString(),
      twilio_call_sid: 'TEST-' + Date.now()
    })
    .select()
    .single()

  if (callError || !testCall) {
    console.error('❌ Could not create test call:', callError)
    return
  }

  console.log('✅ Created test call with ID:', testCall.id)

  // Now update voip_users with this call ID
  console.log('\n🔄 Updating voip_users.current_call_id...')
  const { data: updateData, error: updateError } = await supabase
    .from('voip_users')
    .update({
      current_call_id: testCall.id,
      current_call_phone_number: '+15551234567',
      current_call_answered_at: new Date().toISOString()
    })
    .eq('id', dougId)
    .select()

  if (updateError) {
    console.error('❌ Update failed:', updateError)
    return
  }

  console.log('✅ Update successful!')
  console.log('Updated data:', JSON.stringify(updateData, null, 2))

  console.log('\n📡 CHECK RHONDA\'S BROWSER - she should see Doug on a call now!')
  console.log('⏳ Waiting 10 seconds...\n')

  await new Promise(resolve => setTimeout(resolve, 10000))

  // Clean up
  console.log('🧹 Cleaning up...')
  await supabase
    .from('voip_users')
    .update({
      current_call_id: null,
      current_call_phone_number: null,
      current_call_answered_at: null
    })
    .eq('id', dougId)

  await supabase
    .from('calls')
    .delete()
    .eq('id', testCall.id)

  console.log('✅ Cleanup complete!')
  process.exit(0)
}

testVoipUsersUpdate()

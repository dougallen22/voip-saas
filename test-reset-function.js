const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zcosbiwvstrwmyioqdjw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testResetFunction() {
  console.log('🧪 Testing reset_call_counts() function...\n')

  // Call the reset function
  console.log('Calling reset_call_counts()...')
  const { data, error } = await supabase.rpc('reset_call_counts')

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log('✅ reset_call_counts() executed successfully\n')

  // Check the counts
  const { data: users, error: userError } = await supabase
    .from('voip_users')
    .select('id, today_inbound_calls, today_outbound_calls, last_count_reset_date')
    .order('created_at', { ascending: false })

  if (userError) {
    console.error('❌ Error fetching users:', userError)
    return
  }

  console.log('Current counts after reset:')
  users.forEach((user, idx) => {
    console.log('  User', idx + 1 + ':', 'IB=' + user.today_inbound_calls, 'OB=' + user.today_outbound_calls, 'Last reset:', user.last_count_reset_date)
  })

  console.log('\n📋 Reset schedule:')
  console.log('  ✓ Daily: Midnight every day')
  console.log('  ✓ Weekly: Midnight every Sunday (day 0)')
  console.log('  ✓ Monthly: Midnight on the 1st of each month')
  console.log('  ✓ Yearly: Midnight on January 1st')
  console.log('\nThe reset_call_counts() function is called automatically before incrementing counts.')
}

testResetFunction().catch(console.error)

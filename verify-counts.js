const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zcosbiwvstrwmyioqdjw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyCounts() {
  console.log('🔍 Verifying current call counts...\n')

  const { data: users, error } = await supabase
    .from('voip_users')
    .select('id, today_inbound_calls, today_outbound_calls, weekly_inbound_calls, weekly_outbound_calls, monthly_inbound_calls, monthly_outbound_calls, last_count_reset_date, last_week_reset_date, last_month_reset_date')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log('Found', users.length, 'users:\n')

  users.forEach((user, idx) => {
    console.log(idx + 1 + '. User', user.id)
    console.log('   Today: IB=' + user.today_inbound_calls + ' OB=' + user.today_outbound_calls)
    console.log('   Weekly: IB=' + user.weekly_inbound_calls + ' OB=' + user.weekly_outbound_calls)
    console.log('   Monthly: IB=' + user.monthly_inbound_calls + ' OB=' + user.monthly_outbound_calls)
    console.log('   Last reset: daily=' + user.last_count_reset_date + ', weekly=' + user.last_week_reset_date + ', monthly=' + user.last_month_reset_date)
    console.log('')
  })
}

verifyCounts().catch(console.error)

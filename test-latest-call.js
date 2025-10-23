const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zcosbiwvstrwmyioqdjw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjb3NiaXd2c3Ryd215aW9xZGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg0MTQxMSwiZXhwIjoyMDc1NDE3NDExfQ.VRSTyXAQC9QH_cVP40WxAYmfnJFlKCBGYD2XyvtKQtc'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkLatestCall() {
  console.log('🔍 Checking latest call...\n')

  // Get the most recent call
  const { data: call, error } = await supabase
    .from('calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log('Latest call details:')
  console.log('  ID:', call.id)
  console.log('  From:', call.from_number)
  console.log('  Status:', call.status)
  console.log('  Direction:', call.direction)
  console.log('  answered_by_user_id:', call.answered_by_user_id || 'NULL ❌')
  console.log('  assigned_to:', call.assigned_to || 'NULL')
  console.log('  answered_at:', call.answered_at || 'NULL')
  console.log('  created_at:', call.created_at)
  console.log('  organization_id:', call.organization_id || 'NULL')
  console.log('')

  if (!call.answered_by_user_id) {
    console.log('⚠️ answered_by_user_id is NULL!')
    console.log('This field should be set when the call is answered.')
    console.log('Check the update-user-call API endpoint logs.')
  } else {
    console.log('✅ answered_by_user_id is set!')
    console.log('Fetching user info...')

    // Try to get user from voip_users
    const { data: user, error: userError } = await supabase
      .from('voip_users')
      .select('*')
      .eq('id', call.answered_by_user_id)
      .single()

    if (userError) {
      console.log('❌ Error fetching user:', userError)
    } else {
      console.log('User found:', user)
    }
  }
}

checkLatestCall().catch(console.error)

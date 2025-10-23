const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zcosbiwvstrwmyioqdjw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjb3NiaXd2c3Ryd215aW9xZGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg0MTQxMSwiZXhwIjoyMDc1NDE3NDExfQ.VRSTyXAQC9QH_cVP40WxAYmfnJFlKCBGYD2XyvtKQtc'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testUpdateCall() {
  console.log('🔍 Testing call update...\n')

  // Get the latest call
  const { data: call, error: fetchError } = await supabase
    .from('calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fetchError) {
    console.error('❌ Error fetching call:', fetchError)
    return
  }

  console.log('Latest call:')
  console.log('  ID:', call.id)
  console.log('  From:', call.from_number)
  console.log('  Twilio SID:', call.twilio_call_sid)
  console.log('  Current answered_by_user_id:', call.answered_by_user_id || 'NULL')
  console.log('')

  // Get a user ID to test with
  const { data: users, error: usersError } = await supabase
    .from('voip_users')
    .select('id')
    .limit(1)

  if (usersError || !users || users.length === 0) {
    console.error('❌ Error fetching users:', usersError)
    return
  }

  const testUserId = users[0].id
  console.log('Test user ID:', testUserId)
  console.log('')

  // Try to update the call
  console.log('Attempting to update call with answered_by_user_id...')
  const { data: updated, error: updateError } = await supabase
    .from('calls')
    .update({
      answered_by_user_id: testUserId,
      answered_at: new Date().toISOString(),
      status: 'in-progress'
    })
    .eq('id', call.id)
    .select()

  if (updateError) {
    console.error('❌ Update FAILED:', updateError)
    console.error('Error details:', JSON.stringify(updateError, null, 2))
  } else {
    console.log('✅ Update SUCCESSFUL!')
    console.log('Updated data:', updated)
  }
}

testUpdateCall().catch(console.error)

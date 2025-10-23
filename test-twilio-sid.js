const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zcosbiwvstrwmyioqdjw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjb3NiaXd2c3Ryd215aW9xZGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg0MTQxMSwiZXhwIjoyMDc1NDE3NDExfQ.VRSTyXAQC9QH_cVP40WxAYmfnJFlKCBGYD2XyvtKQtc'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkTwilioSids() {
  console.log('🔍 Checking Twilio SIDs in database...\n')

  // Get recent calls
  const { data: calls, error } = await supabase
    .from('calls')
    .select('id, from_number, status, twilio_call_sid, created_at, answered_by_user_id')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Found ${calls.length} recent calls:\n`)

  calls.forEach((call, i) => {
    console.log(`${i + 1}. ${call.from_number}`)
    console.log(`   Status: ${call.status}`)
    console.log(`   Twilio SID: ${call.twilio_call_sid || 'NULL ❌'}`)
    console.log(`   answered_by_user_id: ${call.answered_by_user_id || 'NULL'}`)
    console.log(`   Created: ${call.created_at}`)
    console.log('')
  })

  const withSid = calls.filter(c => c.twilio_call_sid)
  const withoutSid = calls.filter(c => !c.twilio_call_sid)

  console.log(`✅ Calls with Twilio SID: ${withSid.length}`)
  console.log(`❌ Calls without Twilio SID: ${withoutSid.length}`)

  if (withoutSid.length > 0) {
    console.log('\n⚠️ Problem: Calls are missing twilio_call_sid!')
    console.log('The update-user-call endpoint searches by twilio_call_sid.')
    console.log('If this field is NULL, it cannot find and update the call.')
  }
}

checkTwilioSids().catch(console.error)

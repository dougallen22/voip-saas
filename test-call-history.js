const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zcosbiwvstrwmyioqdjw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjb3NiaXd2c3Ryd215aW9xZGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg0MTQxMSwiZXhwIjoyMDc1NDE3NDExfQ.VRSTyXAQC9QH_cVP40WxAYmfnJFlKCBGYD2XyvtKQtc'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testCallHistory() {
  console.log('🔍 Testing call history query...\n')

  // Get date 7 days ago
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoISO = sevenDaysAgo.toISOString()

  console.log('📅 Fetching calls from:', sevenDaysAgoISO)
  console.log('📅 Current date:', new Date().toISOString())
  console.log('')

  // Fetch calls from last 7 days
  const { data: calls, error } = await supabase
    .from('calls')
    .select(`
      id,
      from_number,
      to_number,
      status,
      direction,
      answered_by_user_id,
      answered_at,
      created_at,
      duration
    `)
    .gte('created_at', sevenDaysAgoISO)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`📊 Found ${calls.length} calls in last 7 days\n`)

  // Categorize calls
  const answered = calls.filter(c => c.answered_by_user_id)
  const missed = calls.filter(c => !c.answered_by_user_id && (c.status === 'ringing' || c.status === 'no-answer' || c.status === 'busy'))
  const other = calls.filter(c => !c.answered_by_user_id && c.status !== 'ringing' && c.status !== 'no-answer' && c.status !== 'busy')

  console.log('✅ Answered calls:', answered.length)
  console.log('📵 Missed calls:', missed.length)
  console.log('📞 Other calls:', other.length)
  console.log('')

  // Get unique user IDs
  const userIds = [...new Set(answered.map(c => c.answered_by_user_id).filter(Boolean))]
  console.log('👥 Unique users who answered calls:', userIds.length)
  console.log('   User IDs:', userIds)
  console.log('')

  // Show sample calls
  console.log('Sample answered calls:')
  answered.slice(0, 3).forEach((call, i) => {
    console.log(`\n  ${i + 1}. ${call.from_number}`)
    console.log(`     Status: ${call.status}`)
    console.log(`     Direction: ${call.direction}`)
    console.log(`     Answered by: ${call.answered_by_user_id || 'NULL'}`)
    console.log(`     Created: ${call.created_at}`)
  })

  console.log('\n\nSample missed calls:')
  missed.slice(0, 3).forEach((call, i) => {
    console.log(`\n  ${i + 1}. ${call.from_number}`)
    console.log(`     Status: ${call.status}`)
    console.log(`     Direction: ${call.direction}`)
    console.log(`     Answered by: ${call.answered_by_user_id || 'NULL'}`)
    console.log(`     Created: ${call.created_at}`)
  })
}

testCallHistory().catch(console.error)

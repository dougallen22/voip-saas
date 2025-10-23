const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zcosbiwvstrwmyioqdjw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjb3NiaXd2c3Ryd215aW9xZGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg0MTQxMSwiZXhwIjoyMDc1NDE3NDExfQ.VRSTyXAQC9QH_cVP40WxAYmfnJFlKCBGYD2XyvtKQtc'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testCallCounts() {
  console.log('🔍 Testing call counts query...\n')

  // Get today's date
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  console.log('📅 Today starts at:', todayISO)
  console.log('')

  // Test 1: Get ALL calls (no filters)
  console.log('Test 1: ALL calls in database')
  const { data: allCalls, error: allError } = await supabase
    .from('calls')
    .select('id, answered_by_user_id, direction, created_at, status, metadata')
    .order('created_at', { ascending: false })
    .limit(10)

  if (allError) {
    console.error('❌ Error:', allError)
  } else {
    console.log('Total recent calls:', allCalls?.length || 0)
    allCalls?.forEach((call, i) => {
      console.log(`\nCall ${i + 1}:`)
      console.log('  ID:', call.id)
      console.log('  Answered by:', call.answered_by_user_id || 'NULL')
      console.log('  Direction (column):', call.direction || 'NULL')
      console.log('  Direction (metadata):', call.metadata?.direction || 'NULL')
      console.log('  Status:', call.status)
      console.log('  Created:', call.created_at)
    })
  }

  console.log('\n' + '='.repeat(60) + '\n')

  // Test 2: Calls from today with answered_by_user_id
  console.log('Test 2: Today\'s calls with answered_by_user_id')
  const { data: todayCalls, error: todayError } = await supabase
    .from('calls')
    .select('id, answered_by_user_id, direction, created_at, status, metadata')
    .gte('created_at', todayISO)
    .not('answered_by_user_id', 'is', null)

  if (todayError) {
    console.error('❌ Error:', todayError)
  } else {
    console.log('Total calls matching query:', todayCalls?.length || 0)
    todayCalls?.forEach((call, i) => {
      console.log(`\nCall ${i + 1}:`)
      console.log('  Answered by:', call.answered_by_user_id)
      console.log('  Direction (column):', call.direction || 'NULL')
      console.log('  Direction (metadata):', call.metadata?.direction || 'NULL')
      console.log('  Status:', call.status)
      console.log('  Created:', call.created_at)
    })

    // Count by user
    const counts = {}
    todayCalls?.forEach(call => {
      const userId = call.answered_by_user_id
      if (!userId) return

      if (!counts[userId]) {
        counts[userId] = { inbound: 0, outbound: 0 }
      }

      const direction = call.direction || call.metadata?.direction
      if (direction === 'inbound') {
        counts[userId].inbound++
      } else if (direction === 'outbound') {
        counts[userId].outbound++
      }
    })

    console.log('\n📊 Counts by user:')
    console.log(JSON.stringify(counts, null, 2))
  }

  console.log('\n' + '='.repeat(60) + '\n')

  // Test 3: Check if direction column exists
  console.log('Test 3: Check table structure')
  const { data: tableInfo, error: tableError } = await supabase
    .from('calls')
    .select('*')
    .limit(1)

  if (!tableError && tableInfo && tableInfo[0]) {
    console.log('Columns in calls table:', Object.keys(tableInfo[0]))
    console.log('Has direction column:', 'direction' in tableInfo[0])
  }
}

testCallCounts().catch(console.error)

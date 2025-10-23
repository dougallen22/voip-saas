const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zcosbiwvstrwmyioqdjw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjb3NiaXd2c3Ryd215aW9xZGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg0MTQxMSwiZXhwIjoyMDc1NDE3NDExfQ.VRSTyXAQC9QH_cVP40WxAYmfnJFlKCBGYD2XyvtKQtc'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAssignedTo() {
  console.log('🔍 Checking assigned_to vs answered_by_user_id...\n')

  const { data: calls, error } = await supabase
    .from('calls')
    .select('id, assigned_to, answered_by_user_id, status, direction, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Found ${calls.length} recent calls:\n`)

  calls.forEach((call, i) => {
    console.log(`Call ${i + 1}:`)
    console.log('  Status:', call.status)
    console.log('  Direction:', call.direction)
    console.log('  assigned_to:', call.assigned_to || 'NULL')
    console.log('  answered_by_user_id:', call.answered_by_user_id || 'NULL')
    console.log('  Created:', call.created_at)
    console.log('')
  })

  // Count using assigned_to
  const assignedCounts = {}
  calls.forEach(call => {
    if (call.assigned_to) {
      if (!assignedCounts[call.assigned_to]) {
        assignedCounts[call.assigned_to] = { inbound: 0, outbound: 0 }
      }
      if (call.direction === 'inbound') assignedCounts[call.assigned_to].inbound++
      if (call.direction === 'outbound') assignedCounts[call.assigned_to].outbound++
    }
  })

  console.log('📊 Counts using assigned_to:')
  console.log(JSON.stringify(assignedCounts, null, 2))
}

checkAssignedTo().catch(console.error)

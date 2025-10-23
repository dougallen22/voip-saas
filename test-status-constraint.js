const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zcosbiwvstrwmyioqdjw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjb3NiaXd2c3Ryd215aW9xZGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg0MTQxMSwiZXhwIjoyMDc1NDE3NDExfQ.VRSTyXAQC9QH_cVP40WxAYmfnJFlKCBGYD2XyvtKQtc'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkConstraint() {
  console.log('🔍 Checking calls table constraints...\n')

  // Query to get constraint definition
  const { data, error } = await supabase
    .from('calls')
    .select('status')
    .limit(10)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log('Sample status values from existing calls:')
  const statusValues = [...new Set(data.map(c => c.status))]
  statusValues.forEach(status => {
    console.log(`  - "${status}"`)
  })
}

checkConstraint().catch(console.error)

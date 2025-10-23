const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zcosbiwvstrwmyioqdjw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjb3NiaXd2c3Ryd215aW9xZGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg0MTQxMSwiZXhwIjoyMDc1NDE3NDExfQ.VRSTyXAQC9QH_cVP40WxAYmfnJFlKCBGYD2XyvtKQtc'

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigration() {
  console.log('🔧 Applying reset logic fix...\n')

  // Read the migration file
  const sql = fs.readFileSync('./database/migrations/10_fix_reset_logic.sql', 'utf8')

  try {
    // Apply the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql })

    if (error) {
      console.error('❌ Error applying migration:', error)
      return
    }

    console.log('✅ Migration applied successfully!\n')

    // Now manually reset all counts to 0 for today
    console.log('🔄 Resetting all counts to 0...')
    const { error: resetError } = await supabase
      .from('voip_users')
      .update({
        today_inbound_calls: 0,
        today_outbound_calls: 0,
        weekly_inbound_calls: 0,
        weekly_outbound_calls: 0,
        monthly_inbound_calls: 0,
        monthly_outbound_calls: 0,
        yearly_inbound_calls: 0,
        yearly_outbound_calls: 0,
        last_count_reset_date: new Date().toISOString().split('T')[0],
        last_week_reset_date: new Date().toISOString().split('T')[0],
        last_month_reset_date: new Date().toISOString().split('T')[0],
        last_year_reset_date: new Date().toISOString().split('T')[0]
      })
      .not('id', 'is', null)

    if (resetError) {
      console.error('❌ Error resetting counts:', resetError)
      return
    }

    console.log('✅ All counts reset to 0\n')
    console.log('📊 Call counts will now reset:')
    console.log('   - Daily: Every midnight')
    console.log('   - Weekly: Every Sunday at midnight')
    console.log('   - Monthly: Every 1st of the month at midnight')
    console.log('   - Yearly: Every January 1st at midnight')

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

applyMigration().catch(console.error)

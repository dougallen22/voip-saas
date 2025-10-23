/**
 * Check and Clear Stale Call Status
 *
 * This script:
 * 1. Shows current voip_users with current_call_id set
 * 2. Clears all current_call_id fields to fix stuck "On Call" status
 * 3. Deletes stale active_calls
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkAndClear() {
  console.log('🔍 Checking voip_users for stale call status...\n')

  // 1. Check current state
  const { data: users, error: fetchError } = await supabase
    .from('voip_users')
    .select('id, current_call_id, current_call_phone_number, current_call_answered_at')
    .not('current_call_id', 'is', null)

  if (fetchError) {
    console.error('❌ Error fetching users:', fetchError)
    return
  }

  if (!users || users.length === 0) {
    console.log('✅ No users with current_call_id set - database is clean!')
    return
  }

  console.log(`⚠️ Found ${users.length} user(s) with current_call_id set:\n`)
  users.forEach(user => {
    console.log(`  - User ID: ${user.id}`)
    console.log(`    current_call_id: ${user.current_call_id}`)
    console.log(`    current_call_phone_number: ${user.current_call_phone_number}`)
    console.log(`    current_call_answered_at: ${user.current_call_answered_at}`)
    console.log('')
  })

  // 2. Clear current_call_id for ALL users
  console.log('🧹 Clearing current_call_id for all users...')
  const { error: updateError } = await supabase
    .from('voip_users')
    .update({
      current_call_id: null,
      current_call_phone_number: null,
      current_call_answered_at: null
    })
    .not('current_call_id', 'is', null)

  if (updateError) {
    console.error('❌ Error updating users:', updateError)
  } else {
    console.log('✅ Cleared current_call_id for all users')
  }

  // 3. Delete ALL active_calls
  console.log('\n🧹 Clearing active_calls table...')
  const { data: activeCalls, error: activeCallsError } = await supabase
    .from('active_calls')
    .select('*')

  if (!activeCallsError && activeCalls) {
    console.log(`  Found ${activeCalls.length} active_calls rows`)

    if (activeCalls.length > 0) {
      const { error: deleteError } = await supabase
        .from('active_calls')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows (matches all valid UUIDs)

      if (deleteError) {
        console.error('❌ Error deleting active_calls:', deleteError)
      } else {
        console.log('✅ Deleted all active_calls')
      }
    }
  }

  console.log('\n✅ Database cleanup complete!')
  console.log('   Refresh your browser to see the updated status.')
}

checkAndClear()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function cleanupStaleCalls() {
  console.log('🧹 Starting stale call cleanup...\n')

  // Delete active_calls older than 1 minute with status 'ringing'
  // These are calls that were never answered or rejected
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()

  const { data: staleCalls, error: fetchError } = await supabase
    .from('active_calls')
    .select('*')
    .eq('status', 'ringing')
    .lt('created_at', oneMinuteAgo)

  if (fetchError) {
    console.error('❌ Error fetching stale calls:', fetchError)
    return
  }

  console.log(`Found ${staleCalls?.length || 0} stale ringing calls older than 1 minute`)

  if (staleCalls && staleCalls.length > 0) {
    const { error: deleteError } = await supabase
      .from('active_calls')
      .delete()
      .eq('status', 'ringing')
      .lt('created_at', oneMinuteAgo)

    if (deleteError) {
      console.error('❌ Error deleting stale calls:', deleteError)
    } else {
      console.log(`✅ Deleted ${staleCalls.length} stale ringing calls`)
    }
  }

  // Also clear current_call_id from users who have no active calls
  const { data: allActiveCalls } = await supabase
    .from('active_calls')
    .select('agent_id')
    .eq('status', 'active')

  const activeAgentIds = new Set(allActiveCalls?.map(c => c.agent_id) || [])

  const { data: usersWithCalls } = await supabase
    .from('voip_users')
    .select('id, full_name, current_call_id')
    .not('current_call_id', 'is', null)

  const usersToClean = usersWithCalls?.filter(u => !activeAgentIds.has(u.id)) || []

  if (usersToClean.length > 0) {
    console.log(`\nFound ${usersToClean.length} users with stale current_call_id`)

    for (const user of usersToClean) {
      const { error } = await supabase
        .from('voip_users')
        .update({
          current_call_id: null,
          current_call_phone_number: null,
          current_call_answered_at: null
        })
        .eq('id', user.id)

      if (error) {
        console.error(`❌ Error clearing user ${user.full_name}:`, error)
      } else {
        console.log(`✅ Cleared stale call state for ${user.full_name || user.id}`)
      }
    }
  }

  console.log('\n✅ Cleanup complete!')
}

cleanupStaleCalls()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

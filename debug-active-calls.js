const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugActiveCalls() {
  console.log('\n=== ACTIVE CALLS TABLE ===')
  const { data: activeCalls, error: acError } = await supabase
    .from('active_calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (acError) {
    console.error('Error:', acError)
  } else {
    console.log('Active calls:', activeCalls)
    console.log('Count:', activeCalls?.length || 0)
  }

  console.log('\n=== VOIP USERS ===')
  const { data: users, error: userError } = await supabase
    .from('voip_users')
    .select('id, full_name, email, current_call_id, current_call_phone_number, is_available')
    .order('full_name')

  if (userError) {
    console.error('Error:', userError)
  } else {
    console.log('Users:', users)
  }

  console.log('\n=== RECENT CALLS ===')
  const { data: calls, error: callError } = await supabase
    .from('calls')
    .select('id, twilio_call_sid, status, assigned_to, from_number, answered_at')
    .order('created_at', { ascending: false })
    .limit(5)

  if (callError) {
    console.error('Error:', callError)
  } else {
    console.log('Recent calls:', calls)
  }

  process.exit(0)
}

debugActiveCalls()

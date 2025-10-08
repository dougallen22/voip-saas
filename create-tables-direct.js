const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: 'public' },
    auth: { persistSession: false }
  }
)

async function createTables() {
  console.log('🔍 Checking if tables already exist...\n')

  // Check call_claims
  const { error: claimsCheckError } = await supabase
    .from('call_claims')
    .select('id')
    .limit(1)

  // Check ring_events
  const { error: eventsCheckError } = await supabase
    .from('ring_events')
    .select('id')
    .limit(1)

  if (!claimsCheckError && !eventsCheckError) {
    console.log('✅ Tables already exist!')
    console.log('   - call_claims: EXISTS')
    console.log('   - ring_events: EXISTS')
    console.log('\nMulti-agent feature is ready to use!')
    process.exit(0)
  }

  if (!claimsCheckError) {
    console.log('✅ call_claims table already exists')
  } else {
    console.log('⚠️  call_claims table does not exist')
  }

  if (!eventsCheckError) {
    console.log('✅ ring_events table already exists')
  } else {
    console.log('⚠️  ring_events table does not exist')
  }

  console.log('\n❌ Tables need to be created via Supabase SQL Editor')
  console.log('\n📋 Go to: https://supabase.com/dashboard/project/zcosbiwvstrwmyioqdjw/sql/new')
  console.log('\n📝 Copy the contents of COMPLETE-MULTI-AGENT-MIGRATION.sql and paste it there')
  console.log('   Then click RUN\n')
}

createTables().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})

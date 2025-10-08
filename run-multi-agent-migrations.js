const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runMigrations() {
  console.log('🗄️  Applying Multi-Agent Migrations...\n')

  // Migration 1: call_claims table
  console.log('📝 Migration 1: Creating call_claims table...')
  const sql1 = fs.readFileSync('supabase/migrations/001_call_claims_table.sql', 'utf8')

  const { error: error1 } = await supabase.rpc('query', { sql: sql1 }).single()
  if (error1) {
    console.error('❌ Error:', error1)
    console.log('\n⚠️  Trying table creation directly...')

    // Try creating table directly
    const { error: createError1 } = await supabase
      .from('call_claims')
      .select('*')
      .limit(0)

    if (createError1 && createError1.code !== 'PGRST116') {
      console.log('Table does not exist, creating via raw SQL...')
      console.log('\n📋 Please run this SQL in Supabase SQL Editor:')
      console.log('https://supabase.com/dashboard/project/zcosbiwvstrwmyioqdjw/sql/new\n')
      console.log(sql1)
      console.log('\n---\n')
    }
  } else {
    console.log('✅ call_claims table created')
  }

  // Migration 2: ring_events table
  console.log('\n📝 Migration 2: Creating ring_events table...')
  const sql2 = fs.readFileSync('supabase/migrations/002_ring_events_table.sql', 'utf8')

  const { error: error2 } = await supabase.rpc('query', { sql: sql2 }).single()
  if (error2) {
    console.error('❌ Error:', error2)
    console.log('\n📋 Please run this SQL in Supabase SQL Editor:')
    console.log(sql2)
    console.log('\n---\n')
  } else {
    console.log('✅ ring_events table created')
  }

  // Migration 3: claim_call function
  console.log('\n📝 Migration 3: Creating claim_call function...')
  const sql3 = fs.readFileSync('supabase/migrations/003_claim_call_function.sql', 'utf8')

  const { error: error3 } = await supabase.rpc('query', { sql: sql3 }).single()
  if (error3) {
    console.error('❌ Error:', error3)
    console.log('\n📋 Please run this SQL in Supabase SQL Editor:')
    console.log(sql3)
    console.log('\n---\n')
  } else {
    console.log('✅ claim_call function created')
  }

  // Verify tables exist
  console.log('\n🔍 Verifying migrations...')

  const { error: verifyError1 } = await supabase
    .from('call_claims')
    .select('id')
    .limit(1)

  const { error: verifyError2 } = await supabase
    .from('ring_events')
    .select('id')
    .limit(1)

  if (!verifyError1) console.log('✅ call_claims table accessible')
  else console.log('⚠️  call_claims table not found:', verifyError1.message)

  if (!verifyError2) console.log('✅ ring_events table accessible')
  else console.log('⚠️  ring_events table not found:', verifyError2.message)

  console.log('\n✅ Migration script complete!')
  console.log('\nIf tables were not created automatically, please run the SQL')
  console.log('files in Supabase SQL Editor as shown above.')
}

runMigrations().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

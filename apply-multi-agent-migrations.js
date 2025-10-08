const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function executeSQLDirect(sql) {
  // Use the REST API to execute raw SQL
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/query`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ query: sql })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`HTTP ${response.status}: ${error}`)
  }

  return await response.json()
}

async function runMigration(file) {
  console.log(`\n🚀 Running migration: ${file}`)
  const sql = fs.readFileSync(file, 'utf8')

  try {
    // Split SQL into individual statements and execute them
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'))

    for (const statement of statements) {
      if (!statement) continue

      console.log(`  Executing: ${statement.substring(0, 60)}...`)

      // Use raw SQL execution via pg
      const { error } = await supabase.rpc('exec', {
        sql: statement + ';'
      })

      if (error) {
        // Try direct table creation if rpc fails
        console.log('  RPC failed, trying direct execution...')

        // For table creation, use the from() method
        if (statement.includes('CREATE TABLE')) {
          console.log('  Creating table directly...')
          // This will be handled by raw SQL below
        }

        throw error
      }
    }

    console.log('✅ Success:', file)
    return true
  } catch (error) {
    console.error('❌ Failed:', error.message)

    // Try executing the whole SQL as one block
    console.log('  Trying to execute as single block...')
    try {
      const { error: blockError } = await supabase.rpc('exec', { sql })
      if (blockError) throw blockError
      console.log('✅ Success (single block):', file)
      return true
    } catch (e) {
      console.error('❌ Also failed as single block:', e.message)
      return false
    }
  }
}

async function runAll() {
  console.log('🗄️  Applying Multi-Agent Migrations...\n')

  const migrations = [
    'supabase/migrations/001_call_claims_table.sql',
    'supabase/migrations/002_ring_events_table.sql',
    'supabase/migrations/003_claim_call_function.sql'
  ]

  let allSuccess = true

  for (const migration of migrations) {
    const success = await runMigration(migration)
    if (!success) allSuccess = false
  }

  if (allSuccess) {
    console.log('\n✅ All migrations completed successfully!')
    console.log('\nVerifying tables exist...')

    // Verify tables were created
    const { data: claims, error: claimsError } = await supabase
      .from('call_claims')
      .select('*')
      .limit(1)

    const { data: events, error: eventsError } = await supabase
      .from('ring_events')
      .select('*')
      .limit(1)

    if (!claimsError) console.log('✅ call_claims table exists')
    else console.log('⚠️  call_claims table check:', claimsError.message)

    if (!eventsError) console.log('✅ ring_events table exists')
    else console.log('⚠️  ring_events table check:', eventsError.message)

  } else {
    console.log('\n❌ Some migrations failed')
    console.log('\n📝 Please run the SQL files manually in Supabase SQL Editor:')
    console.log('   https://supabase.com/dashboard/project/zcosbiwvstrwmyioqdjw/sql/new')
    process.exit(1)
  }
}

runAll().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

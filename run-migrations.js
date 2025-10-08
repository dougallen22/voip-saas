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

const migrations = [
  'supabase/migrations/001_call_claims_table.sql',
  'supabase/migrations/002_ring_events_table.sql',
  'supabase/migrations/003_claim_call_function.sql'
]

async function runMigration(file) {
  console.log(`\n🚀 Running migration: ${file}`)
  const sql = fs.readFileSync(file, 'utf8')

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql })

    if (error) {
      console.error('❌ Error:', error)
      throw error
    }

    console.log('✅ Success:', file)
    return data
  } catch (error) {
    console.error('❌ Failed:', error.message)
    throw error
  }
}

async function runAll() {
  for (const migration of migrations) {
    await runMigration(migration)
  }
  console.log('\n✅ All migrations completed successfully!')
}

runAll().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

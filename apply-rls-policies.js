const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
  const migrationPath = path.join(__dirname, 'database/migrations/04_rls_policies.sql')
  const sql = fs.readFileSync(migrationPath, 'utf8')

  console.log('🚀 Applying RLS policies migration...')

  // Split by semicolon to execute each statement separately
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  for (const statement of statements) {
    try {
      console.log('Executing:', statement.substring(0, 100) + '...')
      const { error } = await supabase.rpc('exec_sql', { sql: statement })
      if (error) {
        console.error('Error:', error)
      } else {
        console.log('✓ Success')
      }
    } catch (err) {
      console.error('Exception:', err)
    }
  }

  console.log('✅ Migration complete!')
}

applyMigration().catch(console.error)

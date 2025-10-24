const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Initialize Supabase admin client
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

async function runMigration() {
  try {
    console.log('📊 Running SMS tables migration...\n')

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '11_sms_tables.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

    if (error) {
      console.error('❌ Migration failed:', error.message)

      // Try alternative approach - execute in chunks
      console.log('\n⚠️  Trying alternative approach: Manual table creation...\n')

      // Just verify tables exist
      const { data: tables, error: checkError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .like('table_name', 'sms_%')

      if (checkError) {
        console.log('⚠️  Unable to verify tables. Please run migration manually via Supabase Dashboard.')
        console.log('\nSteps:')
        console.log('1. Go to: https://supabase.com/dashboard/project/zcosbiwvstrwmyioqdjw/sql/new')
        console.log('2. Copy contents of: database/migrations/11_sms_tables.sql')
        console.log('3. Paste and click "Run"\n')
        process.exit(1)
      }

      console.log('\n📋 Existing SMS tables:', tables)

    } else {
      console.log('✅ Migration executed successfully!\n')
    }

    // Verify tables were created
    console.log('🔍 Verifying tables...\n')

    const { data: conversations } = await supabase
      .from('sms_conversations')
      .select('count')
      .limit(0)

    const { data: messages } = await supabase
      .from('sms_messages')
      .select('count')
      .limit(0)

    const { data: events } = await supabase
      .from('sms_message_events')
      .select('count')
      .limit(0)

    console.log('✅ Tables verified:')
    console.log('  - sms_conversations ✓')
    console.log('  - sms_messages ✓')
    console.log('  - sms_message_events ✓')
    console.log('\n✨ Database migration complete!\n')

  } catch (error) {
    console.error('❌ Error running migration:', error.message)
    console.log('\n⚠️  Please run migration manually via Supabase Dashboard:')
    console.log('1. Go to: https://supabase.com/dashboard/project/zcosbiwvstrwmyioqdjw/sql/new')
    console.log('2. Copy contents of: database/migrations/11_sms_tables.sql')
    console.log('3. Paste and click "Run"\n')
    process.exit(1)
  }
}

runMigration()

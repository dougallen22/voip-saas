const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runSQL() {
  console.log('🚀 Running SQL migration via service role...\n')

  // Try using rpc to execute raw SQL
  const sql = `
    ALTER TABLE public.voip_users
      ADD COLUMN IF NOT EXISTS current_call_phone_number text,
      ADD COLUMN IF NOT EXISTS current_call_answered_at timestamptz;

    CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_phone_number
      ON public.voip_users (current_call_phone_number);
  `

  console.log('SQL to execute:')
  console.log(sql)
  console.log('\nAttempting to execute...\n')

  // Method 1: Try creating a temp function to execute SQL
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec_migration()
    RETURNS void AS $$
    BEGIN
      ALTER TABLE public.voip_users
        ADD COLUMN IF NOT EXISTS current_call_phone_number text,
        ADD COLUMN IF NOT EXISTS current_call_answered_at timestamptz;

      CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_phone_number
        ON public.voip_users (current_call_phone_number);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `

  // Try to create the function first
  const { data: createData, error: createError } = await supabase.rpc('exec_migration')

  if (createError) {
    console.error('❌ Error:', createError)
    console.log('\n📝 The service role can query but cannot execute DDL statements.')
    console.log('We need to use a different approach...\n')
  } else {
    console.log('✅ Migration executed successfully!')
  }

  // Verify columns were added
  console.log('\n🔍 Verifying columns...')
  const { data: users, error: verifyError } = await supabase
    .from('voip_users')
    .select('id, current_call_id, current_call_phone_number, current_call_answered_at')
    .limit(1)

  if (verifyError) {
    if (verifyError.code === '42703') {
      console.log('❌ Columns still missing')
    } else {
      console.error('Error:', verifyError)
    }
  } else {
    console.log('✅ Columns exist! Sample data:', users)
  }

  process.exit(0)
}

runSQL()

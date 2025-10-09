const { createClient } = require('@supabase/supabase-js')

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

async function addColumns() {
  console.log('\n🚀 Adding missing columns to voip_users table...')

  const sql = `
ALTER TABLE public.voip_users
  ADD COLUMN IF NOT EXISTS current_call_phone_number text,
  ADD COLUMN IF NOT EXISTS current_call_answered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_phone_number
  ON public.voip_users (current_call_phone_number);
  `

  console.log('SQL:', sql)

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql })

    if (error) {
      console.error('❌ Error:', error)
      throw error
    }

    console.log('\n✅ Columns added successfully!')

    // Verify
    console.log('\n🔍 Verifying columns...')
    const { data: users, error: verifyError } = await supabase
      .from('voip_users')
      .select('id, current_call_id, current_call_phone_number, current_call_answered_at')
      .limit(2)

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError)
    } else {
      console.log('✅ Verification successful! Sample:', users)
    }

    return data
  } catch (error) {
    console.error('❌ Failed:', error.message || error)
    throw error
  }
}

addColumns()
  .then(() => {
    console.log('\n🎉 Migration complete! Now test answering a call.')
    process.exit(0)
  })
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })

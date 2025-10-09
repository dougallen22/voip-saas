const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function addMissingColumns() {
  console.log('Adding missing columns to voip_users...')

  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE public.voip_users
        ADD COLUMN IF NOT EXISTS current_call_phone_number text,
        ADD COLUMN IF NOT EXISTS current_call_answered_at timestamptz;

      CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_phone_number
        ON public.voip_users (current_call_phone_number);
    `
  })

  if (error) {
    console.error('Error:', error)
    console.log('\nManually run this SQL in Supabase SQL Editor:')
    console.log(`
ALTER TABLE public.voip_users
  ADD COLUMN IF NOT EXISTS current_call_phone_number text,
  ADD COLUMN IF NOT EXISTS current_call_answered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_phone_number
  ON public.voip_users (current_call_phone_number);
    `)
  } else {
    console.log('✅ Columns added successfully!')
  }

  process.exit(0)
}

addMissingColumns()

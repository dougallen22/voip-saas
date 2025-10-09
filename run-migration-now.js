const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runMigration() {
  console.log('🚀 Adding missing columns to voip_users table...\n')

  // Add current_call_phone_number column
  console.log('1. Adding current_call_phone_number column...')
  const { error: col1Error } = await supabase
    .from('voip_users')
    .select('current_call_phone_number')
    .limit(1)

  if (col1Error && col1Error.code === '42703') {
    console.log('   Column does not exist, needs to be added via SQL editor')
  } else if (col1Error) {
    console.error('   Error checking column:', col1Error)
  } else {
    console.log('   ✅ Column already exists')
  }

  // Add current_call_answered_at column
  console.log('2. Adding current_call_answered_at column...')
  const { error: col2Error } = await supabase
    .from('voip_users')
    .select('current_call_answered_at')
    .limit(1)

  if (col2Error && col2Error.code === '42703') {
    console.log('   Column does not exist, needs to be added via SQL editor')
  } else if (col2Error) {
    console.error('   Error checking column:', col2Error)
  } else {
    console.log('   ✅ Column already exists')
  }

  console.log('\n' + '='.repeat(60))
  console.log('MANUAL STEP REQUIRED')
  console.log('='.repeat(60))
  console.log('\nGo to: https://supabase.com/dashboard/project/zcosbiwvstrwmyioqdjw/sql/new')
  console.log('\nPaste and run this SQL:\n')
  console.log('ALTER TABLE public.voip_users')
  console.log('  ADD COLUMN IF NOT EXISTS current_call_phone_number text,')
  console.log('  ADD COLUMN IF NOT EXISTS current_call_answered_at timestamptz;')
  console.log('')
  console.log('CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_phone_number')
  console.log('  ON public.voip_users (current_call_phone_number);')
  console.log('\n' + '='.repeat(60))

  process.exit(0)
}

runMigration()

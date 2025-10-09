const { execSync } = require('child_process')

const sql = `
ALTER TABLE public.voip_users
  ADD COLUMN IF NOT EXISTS current_call_phone_number text,
  ADD COLUMN IF NOT EXISTS current_call_answered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_phone_number
  ON public.voip_users (current_call_phone_number);
`

console.log('🚀 Running migration via psql...\n')
console.log('SQL:', sql)

// Try multiple connection strings
const connectionStrings = [
  'postgres://postgres.zcosbiwvstrwmyioqdjw@aws-0-us-east-1.pooler.supabase.com:5432/postgres',
  'postgres://postgres@aws-0-us-east-1.pooler.supabase.com:6543/postgres?user=postgres.zcosbiwvstrwmyioqdjw',
  'postgresql://postgres:3Tw1l102024%23@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require'
]

for (const connStr of connectionStrings) {
  console.log(`\n\n🔄 Trying connection: ${connStr.replace(/:[^:@]+@/, ':****@')}`)

  try {
    const result = execSync(`PGPASSWORD="3Tw1l102024#" psql "${connStr}" -c "${sql.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8',
      stdio: 'pipe'
    })

    console.log('✅ SUCCESS!')
    console.log(result)

    // Verify
    const verify = execSync(`PGPASSWORD="3Tw1l102024#" psql "${connStr}" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'voip_users' AND column_name IN ('current_call_phone_number', 'current_call_answered_at');"`, {
      encoding: 'utf8'
    })
    console.log('\n🔍 Verification:', verify)

    process.exit(0)
  } catch (error) {
    console.log('❌ Failed:', error.message)
  }
}

console.log('\n\n❌ All connection attempts failed.')
process.exit(1)

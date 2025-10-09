const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkPublication() {
  console.log('🔍 Checking PostgreSQL publication for realtime...\n')

  // Check if voip_users is in the supabase_realtime publication
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT schemaname, tablename
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime';
    `
  })

  if (error) {
    console.error('❌ Error checking publication:', error)
    return
  }

  console.log('Tables in supabase_realtime publication:')
  console.log(JSON.stringify(data, null, 2))

  const hasVoipUsers = data && data.some(row =>
    row.tablename === 'voip_users' ||
    (typeof row === 'object' && Object.values(row).includes('voip_users'))
  )

  if (hasVoipUsers) {
    console.log('\n✅ voip_users IS in the publication')
  } else {
    console.log('\n❌ voip_users is NOT in the publication')
    console.log('\nTo fix, run this SQL in Supabase Dashboard:')
    console.log('ALTER PUBLICATION supabase_realtime ADD TABLE public.voip_users;')
  }
}

checkPublication().then(() => process.exit(0))

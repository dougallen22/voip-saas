#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function listUsers() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers()

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Auth Users:')
  for (const user of users) {
    console.log(`- ${user.email} (ID: ${user.id})`)
  }

  console.log('\nVoIP Users:')
  const { data: voipUsers } = await supabase
    .from('voip_users')
    .select('id, role')

  for (const voipUser of voipUsers) {
    const authUser = users.find(u => u.id === voipUser.id)
    console.log(`- ${authUser?.email || 'UNKNOWN'} (ID: ${voipUser.id}, Role: ${voipUser.role})`)
  }
}

listUsers()

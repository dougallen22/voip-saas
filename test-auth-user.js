const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zcosbiwvstrwmyioqdjw.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkAuthUser() {
  const targetUserId = '1781c3ad-b7bb-46d3-bce7-e098ae97e8a0'
  console.log('Checking auth user:', targetUserId, '\n')

  const result = await supabase.auth.admin.listUsers()
  
  if (result.error) {
    console.error('Error:', result.error)
    return
  }

  const user = result.data.users.find(u => u.id === targetUserId)
  
  if (!user) {
    console.log('User not found')
    return
  }

  console.log('Auth user found:')
  console.log('  ID:', user.id)
  console.log('  Email:', user.email)
  console.log('  user_metadata:', JSON.stringify(user.user_metadata, null, 2))
  console.log('  full_name from metadata:', user.user_metadata?.full_name || 'NOT SET')
}

checkAuthUser().catch(console.error)

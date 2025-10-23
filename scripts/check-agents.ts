import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkAgents() {
  console.log('Checking all agents in database...\n')

  try {
    // Get all users from voip_users
    const { data: voipUsers, error: voipError } = await supabase
      .from('voip_users')
      .select('*')
      .order('created_at', { ascending: false })

    if (voipError) {
      console.error('Error fetching voip_users:', voipError)
      return
    }

    console.log(`Found ${voipUsers?.length || 0} users in voip_users table:\n`)

    if (voipUsers && voipUsers.length > 0) {
      for (const user of voipUsers) {
        console.log('---')
        console.log('ID:', user.id)
        console.log('Organization ID:', user.organization_id)
        console.log('Role:', user.role)
        console.log('Available:', user.is_available)
        console.log('Created:', user.created_at)

        // Get auth user info
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(user.id)
        if (!authError && authUser?.user) {
          console.log('Email:', authUser.user.email)
          console.log('Full Name:', authUser.user.user_metadata?.full_name || 'N/A')
        }
        console.log('')
      }
    } else {
      console.log('❌ No users found in voip_users table!')
    }

    // Check auth.users table
    console.log('\n--- Checking auth.users table ---\n')
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('Error fetching auth users:', authError)
    } else {
      console.log(`Found ${authUsers?.users?.length || 0} users in auth.users table:\n`)
      authUsers?.users.forEach(user => {
        console.log('ID:', user.id)
        console.log('Email:', user.email)
        console.log('Full Name:', user.user_metadata?.full_name || 'N/A')
        console.log('Created:', user.created_at)
        console.log('---')
      })
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

checkAgents()
  .then(() => {
    console.log('\n✅ Check complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error)
    process.exit(1)
  })

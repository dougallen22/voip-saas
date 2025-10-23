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

async function fixOrganizationIds() {
  console.log('Checking users without organization_id...')

  try {
    // Get all users without organization_id
    const { data: usersWithoutOrg, error: fetchError } = await supabase
      .from('voip_users')
      .select('id, organization_id')
      .is('organization_id', null)

    if (fetchError) {
      console.error('Error fetching users:', fetchError)
      return
    }

    console.log(`Found ${usersWithoutOrg?.length || 0} users without organization_id`)

    if (usersWithoutOrg && usersWithoutOrg.length > 0) {
      // Get or create a default organization
      let { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .limit(1)

      let orgId: string

      if (orgError || !orgs || orgs.length === 0) {
        console.log('No organizations found. Creating default organization...')

        const { data: newOrg, error: createOrgError } = await supabase
          .from('organizations')
          .insert({
            name: 'Default Organization'
          })
          .select()
          .single()

        if (createOrgError) {
          console.error('Error creating organization:', createOrgError)
          return
        }

        orgId = newOrg.id
        console.log('✅ Created default organization:', orgId)
      } else {
        orgId = orgs[0].id
        console.log('Using existing organization:', orgId, '-', orgs[0].name)
      }

      // Update all users without organization_id
      for (const user of usersWithoutOrg) {
        const { error: updateError } = await supabase
          .from('voip_users')
          .update({ organization_id: orgId })
          .eq('id', user.id)

        if (updateError) {
          console.error(`Error updating user ${user.id}:`, updateError)
        } else {
          console.log(`✅ Updated user ${user.id} with organization_id: ${orgId}`)
        }
      }

      console.log('\n✅ All users now have organization_id!')
    } else {
      console.log('✅ All users already have organization_id')
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

fixOrganizationIds()
  .then(() => {
    console.log('\n✅ Fix complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error)
    process.exit(1)
  })

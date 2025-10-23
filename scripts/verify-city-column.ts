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

async function verifyCity() {
  console.log('Checking city column...')

  try {
    // Try to query the city column
    const { data, error } = await supabase
      .from('contacts')
      .select('id, city')
      .limit(1)

    if (error) {
      console.error('❌ Error querying city column:', error.message)

      if (error.message.includes('column "city" does not exist')) {
        console.log('\n⚠️  City column does NOT exist. Running migration...\n')

        // Try to add it
        console.log('Please run this SQL in Supabase SQL Editor:')
        console.log('ALTER TABLE contacts ADD COLUMN city TEXT;')
      }
    } else {
      console.log('✅ City column exists!')
      console.log('Sample data:', data)
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

verifyCity()
  .then(() => {
    console.log('\nVerification complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nVerification failed:', error)
    process.exit(1)
  })

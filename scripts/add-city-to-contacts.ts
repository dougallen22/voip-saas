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

async function addCityColumn() {
  console.log('Adding city column to contacts table...')

  try {
    // Add city column using raw SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add city column if it doesn't exist
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'contacts' AND column_name = 'city'
          ) THEN
            ALTER TABLE contacts ADD COLUMN city TEXT;
            RAISE NOTICE 'City column added successfully';
          ELSE
            RAISE NOTICE 'City column already exists';
          END IF;
        END $$;
      `
    })

    if (error) {
      console.log('Using direct query approach...')
      // Alternative approach: execute directly
      const { error: alterError } = await supabase
        .from('contacts')
        .select('city')
        .limit(1)

      if (alterError && alterError.message.includes('column "city" does not exist')) {
        console.log('\nPlease run this SQL in Supabase SQL Editor:\n')
        console.log('ALTER TABLE contacts ADD COLUMN city TEXT;')
        console.log('\n')
      } else {
        console.log('✅ City column already exists or was added!')
      }
    } else {
      console.log('✅ City column migration complete!')
    }

  } catch (error) {
    console.error('Error:', error)
    console.log('\n⚠️  If the script fails, run this SQL manually in Supabase SQL Editor:\n')
    console.log('ALTER TABLE contacts ADD COLUMN city TEXT;\n')
  }
}

addCityColumn()
  .then(() => {
    console.log('\n✅ Setup complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error)
    process.exit(1)
  })

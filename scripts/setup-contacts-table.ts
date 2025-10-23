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

async function setupContactsTable() {
  console.log('Setting up contacts table...')

  try {
    // Create contacts table
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create contacts table
        CREATE TABLE IF NOT EXISTS contacts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
          business_name TEXT,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          address TEXT,
          state VARCHAR(2),
          zip VARCHAR(10),
          phone TEXT NOT NULL,
          email TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
        CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(first_name, last_name);
        CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

        -- Create updated_at trigger
        CREATE OR REPLACE FUNCTION update_contacts_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS contacts_updated_at_trigger ON contacts;
        CREATE TRIGGER contacts_updated_at_trigger
          BEFORE UPDATE ON contacts
          FOR EACH ROW
          EXECUTE FUNCTION update_contacts_updated_at();

        -- Enable Row Level Security
        ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Users can view contacts from their organization" ON contacts;
        DROP POLICY IF EXISTS "Users can create contacts in their organization" ON contacts;
        DROP POLICY IF EXISTS "Users can update contacts in their organization" ON contacts;
        DROP POLICY IF EXISTS "Users can delete contacts in their organization" ON contacts;

        -- Create RLS policies
        -- Policy: Users can view contacts from their organization
        CREATE POLICY "Users can view contacts from their organization"
          ON contacts FOR SELECT
          USING (
            organization_id IN (
              SELECT organization_id FROM voip_users WHERE id = auth.uid()
            )
          );

        -- Policy: Users can create contacts in their organization
        CREATE POLICY "Users can create contacts in their organization"
          ON contacts FOR INSERT
          WITH CHECK (
            organization_id IN (
              SELECT organization_id FROM voip_users WHERE id = auth.uid()
            )
          );

        -- Policy: Users can update contacts in their organization
        CREATE POLICY "Users can update contacts in their organization"
          ON contacts FOR UPDATE
          USING (
            organization_id IN (
              SELECT organization_id FROM voip_users WHERE id = auth.uid()
            )
          );

        -- Policy: Users can delete contacts in their organization
        CREATE POLICY "Users can delete contacts in their organization"
          ON contacts FOR DELETE
          USING (
            organization_id IN (
              SELECT organization_id FROM voip_users WHERE id = auth.uid()
            )
          );
      `
    })

    if (tableError) {
      // If exec_sql RPC doesn't exist, try direct SQL execution
      console.log('Attempting direct SQL execution...')

      // Note: This approach requires executing SQL statements individually
      // You may need to run this through Supabase SQL editor instead
      console.log(`
        Please run the following SQL in your Supabase SQL Editor:

        -- Create contacts table
        CREATE TABLE IF NOT EXISTS contacts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
          business_name TEXT,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          address TEXT,
          state VARCHAR(2),
          zip VARCHAR(10),
          phone TEXT NOT NULL,
          email TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
        CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(first_name, last_name);
        CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

        -- Create trigger function
        CREATE OR REPLACE FUNCTION update_contacts_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Create trigger
        DROP TRIGGER IF EXISTS contacts_updated_at_trigger ON contacts;
        CREATE TRIGGER contacts_updated_at_trigger
          BEFORE UPDATE ON contacts
          FOR EACH ROW
          EXECUTE FUNCTION update_contacts_updated_at();

        -- Enable RLS
        ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

        -- RLS Policies
        DROP POLICY IF EXISTS "Users can view contacts from their organization" ON contacts;
        CREATE POLICY "Users can view contacts from their organization"
          ON contacts FOR SELECT
          USING (
            organization_id IN (
              SELECT organization_id FROM voip_users WHERE id = auth.uid()
            )
          );

        DROP POLICY IF EXISTS "Users can create contacts in their organization" ON contacts;
        CREATE POLICY "Users can create contacts in their organization"
          ON contacts FOR INSERT
          WITH CHECK (
            organization_id IN (
              SELECT organization_id FROM voip_users WHERE id = auth.uid()
            )
          );

        DROP POLICY IF EXISTS "Users can update contacts in their organization" ON contacts;
        CREATE POLICY "Users can update contacts in their organization"
          ON contacts FOR UPDATE
          USING (
            organization_id IN (
              SELECT organization_id FROM voip_users WHERE id = auth.uid()
            )
          );

        DROP POLICY IF EXISTS "Users can delete contacts in their organization" ON contacts;
        CREATE POLICY "Users can delete contacts in their organization"
          ON contacts FOR DELETE
          USING (
            organization_id IN (
              SELECT organization_id FROM voip_users WHERE id = auth.uid()
            )
          );
      `)

      console.error('Error:', tableError)
      throw new Error('Please execute the SQL manually in Supabase SQL Editor')
    }

    console.log('✅ Contacts table created successfully!')
    console.log('✅ Indexes created')
    console.log('✅ RLS policies enabled')
    console.log('✅ Triggers configured')

  } catch (error) {
    console.error('Error setting up contacts table:', error)
    throw error
  }
}

// Run the setup
setupContactsTable()
  .then(() => {
    console.log('\n✅ Setup complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error)
    process.exit(1)
  })

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Checking environment...');
console.log('Supabase URL:', supabaseUrl ? 'Found' : 'Missing');
console.log('Service Key:', supabaseKey ? 'Found' : 'Missing');

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('\n🔄 Attempting to modify parked_calls table...\n');

    // Try using a workaround: select from the table first to test connection
    const { data: testData, error: testError } = await supabase
      .from('parked_calls')
      .select('id')
      .limit(1);

    if (testError) {
      console.error('❌ Cannot connect to database:', testError.message);
      process.exit(1);
    }

    console.log('✅ Database connection verified');
    console.log('\n📋 SQL to run manually in Supabase SQL Editor:');
    console.log('═'.repeat(60));
    console.log('ALTER TABLE parked_calls ALTER COLUMN twilio_conference_sid DROP NOT NULL;');
    console.log('═'.repeat(60));
    console.log('\nSteps:');
    console.log('1. Go to https://supabase.com/dashboard/project/rjyvpqmocmzdqwdqiqwu');
    console.log('2. Click "SQL Editor" in the left sidebar');
    console.log('3. Click "New Query"');
    console.log('4. Paste the SQL above');
    console.log('5. Click "Run"');
    console.log('\nNote: The Supabase JS client cannot run DDL commands.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runMigration();

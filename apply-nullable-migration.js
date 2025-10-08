const fetch = require('node-fetch');

const projectRef = 'zcosbiwvstrwmyioqdjw';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sql = 'ALTER TABLE parked_calls ALTER COLUMN twilio_conference_sid DROP NOT NULL;';

async function runMigration() {
  console.log('🚀 Running migration via Supabase Management API...');
  console.log('SQL:', sql);

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: sql
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Error response:', result);
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!');
    console.log('Result:', result);
  } catch (error) {
    console.error('❌ Exception:', error);
    process.exit(1);
  }
}

runMigration();

const fetch = require('node-fetch');
const fs = require('fs');

const projectRef = 'zcosbiwvstrwmyioqdjw';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sql = fs.readFileSync('COMPLETE-MULTI-AGENT-MIGRATION.sql', 'utf8');

async function runMigration() {
  console.log('🚀 Running multi-agent migrations via Supabase Management API...');
  console.log('SQL length:', sql.length, 'characters\n');

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
      console.error('❌ Error response:', JSON.stringify(result, null, 2));
      process.exit(1);
    }

    console.log('✅ Migrations completed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Exception:', error);
    process.exit(1);
  }
}

runMigration();

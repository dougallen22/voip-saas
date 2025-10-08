const { Client } = require('pg');
const fs = require('fs');

const sql = fs.readFileSync('COMPLETE-MULTI-AGENT-MIGRATION.sql', 'utf8');

const client = new Client({
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.zcosbiwvstrwmyioqdjw',
  password: 'Parker2222!',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!');

    console.log('\n🚀 Executing migration SQL...');
    const result = await client.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('Result:', result);

    // Verify tables exist
    console.log('\n🔍 Verifying tables...');
    const verifyResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('call_claims', 'ring_events')
      ORDER BY table_name;
    `);

    console.log('Tables created:');
    verifyResult.rows.forEach(row => {
      console.log('  ✅', row.table_name);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();

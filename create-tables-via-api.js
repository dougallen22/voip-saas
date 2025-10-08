const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function createTables() {
  console.log('🚀 Creating tables via Supabase client...\n')

  // We'll use raw SQL via a PostgreSQL query through the REST API
  const statements = [
    // Table 1: call_claims
    `CREATE TABLE IF NOT EXISTS call_claims (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      call_sid text UNIQUE NOT NULL,
      claimed_by uuid REFERENCES voip_users(id) ON DELETE SET NULL,
      claimed_at timestamptz DEFAULT now(),
      expires_at timestamptz DEFAULT now() + interval '30 seconds',
      status text CHECK (status IN ('pending', 'claimed', 'expired')) DEFAULT 'pending',
      created_at timestamptz DEFAULT now()
    )`,

    'CREATE INDEX IF NOT EXISTS idx_call_claims_call_sid ON call_claims(call_sid)',
    'CREATE INDEX IF NOT EXISTS idx_call_claims_status ON call_claims(status)',
    'CREATE INDEX IF NOT EXISTS idx_call_claims_claimed_by ON call_claims(claimed_by)',

    // Trigger function
    `CREATE OR REPLACE FUNCTION expire_old_claims()
    RETURNS trigger AS $$
    BEGIN
      UPDATE call_claims SET status = 'expired' WHERE expires_at < now() AND status = 'pending';
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql`,

    'DROP TRIGGER IF EXISTS expire_claims_trigger ON call_claims',
    'CREATE TRIGGER expire_claims_trigger AFTER INSERT ON call_claims EXECUTE FUNCTION expire_old_claims()',

    'ALTER TABLE call_claims ENABLE ROW LEVEL SECURITY',
    `CREATE POLICY IF NOT EXISTS "Anyone can read call claims" ON call_claims FOR SELECT USING (true)`,
    `CREATE POLICY IF NOT EXISTS "Only service role can modify call claims" ON call_claims FOR ALL USING (false)`,

    // Table 2: ring_events
    `CREATE TABLE IF NOT EXISTS ring_events (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      call_sid text NOT NULL,
      agent_id uuid REFERENCES voip_users(id) ON DELETE CASCADE,
      event_type text CHECK (event_type IN ('ring_start', 'ring_cancel', 'answered', 'declined')) NOT NULL,
      created_at timestamptz DEFAULT now()
    )`,

    'CREATE INDEX IF NOT EXISTS idx_ring_events_call_sid ON ring_events(call_sid)',
    'CREATE INDEX IF NOT EXISTS idx_ring_events_agent_id ON ring_events(agent_id)',
    'CREATE INDEX IF NOT EXISTS idx_ring_events_created_at ON ring_events(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_ring_events_type ON ring_events(event_type)',

    'ALTER TABLE ring_events ENABLE ROW LEVEL SECURITY',
    `CREATE POLICY IF NOT EXISTS "Authenticated users can read ring events" ON ring_events FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon')`,
    `CREATE POLICY IF NOT EXISTS "Only service role can insert ring events" ON ring_events FOR INSERT WITH CHECK (false)`,

    // Cleanup function
    `CREATE OR REPLACE FUNCTION cleanup_old_ring_events() RETURNS void AS $$
    BEGIN
      DELETE FROM ring_events WHERE created_at < now() - interval '24 hours';
    END;
    $$ LANGUAGE plpgsql`,

    // claim_call function
    `CREATE OR REPLACE FUNCTION claim_call(p_call_sid text, p_agent_id uuid)
    RETURNS boolean AS $$
    DECLARE
      v_claimed boolean;
    BEGIN
      INSERT INTO call_claims (call_sid, claimed_by, status)
      VALUES (p_call_sid, p_agent_id, 'claimed')
      ON CONFLICT (call_sid) DO NOTHING
      RETURNING true INTO v_claimed;
      RETURN COALESCE(v_claimed, false);
    END;
    $$ LANGUAGE plpgsql`
  ]

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const preview = stmt.substring(0, 80).replace(/\s+/g, ' ')
    console.log(`${i + 1}/${statements.length}: ${preview}...`)

    try {
      // Try using the client's query method
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/query`, {
        method: 'POST',
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: stmt })
      })

      if (response.ok) {
        console.log('  ✅ Success\n')
      } else {
        const error = await response.text()
        console.log('  ⚠️  Response:', error, '\n')
      }
    } catch (error) {
      console.log('  ⚠️  Error:', error.message, '\n')
    }
  }

  // Verify
  console.log('\n🔍 Verifying tables...')
  const { error: claimsError } = await supabase.from('call_claims').select('id').limit(1)
  const { error: eventsError } = await supabase.from('ring_events').select('id').limit(1)

  if (!claimsError) console.log('✅ call_claims table exists')
  else console.log('❌ call_claims:', claimsError.message)

  if (!eventsError) console.log('✅ ring_events table exists')
  else console.log('❌ ring_events:', eventsError.message)

  if (!claimsError && !eventsError) {
    console.log('\n🎉 Multi-agent feature is ready!')
  }
}

createTables().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

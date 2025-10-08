-- ========================================
-- MULTI-AGENT SIMULTANEOUS RING MIGRATIONS
-- Copy and paste this ENTIRE file into Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/zcosbiwvstrwmyioqdjw/sql/new
-- ========================================

-- Migration 1: call_claims table
-- Purpose: Atomic call claiming to prevent race conditions
CREATE TABLE IF NOT EXISTS call_claims (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_sid text UNIQUE NOT NULL,
  claimed_by uuid REFERENCES voip_users(id) ON DELETE SET NULL,
  claimed_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '30 seconds',
  status text CHECK (status IN ('pending', 'claimed', 'expired')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_claims_call_sid ON call_claims(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_claims_status ON call_claims(status);
CREATE INDEX IF NOT EXISTS idx_call_claims_claimed_by ON call_claims(claimed_by);

CREATE OR REPLACE FUNCTION expire_old_claims()
RETURNS trigger AS $$
BEGIN
  UPDATE call_claims
  SET status = 'expired'
  WHERE expires_at < now() AND status = 'pending';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS expire_claims_trigger ON call_claims;
CREATE TRIGGER expire_claims_trigger
AFTER INSERT ON call_claims
EXECUTE FUNCTION expire_old_claims();

ALTER TABLE call_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read call claims" ON call_claims;
CREATE POLICY "Anyone can read call claims" ON call_claims
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only service role can modify call claims" ON call_claims;
CREATE POLICY "Only service role can modify call claims" ON call_claims
  FOR ALL
  USING (false);

COMMENT ON TABLE call_claims IS 'Tracks which agent claimed an incoming call to prevent race conditions in multi-agent simultaneous ring';
COMMENT ON COLUMN call_claims.call_sid IS 'Twilio Call SID from incoming call';
COMMENT ON COLUMN call_claims.claimed_by IS 'User ID of agent who answered first';
COMMENT ON COLUMN call_claims.status IS 'pending = waiting for answer, claimed = answered, expired = timeout';

-- Migration 2: ring_events table
-- Purpose: Real-time coordination of ring events across agents
CREATE TABLE IF NOT EXISTS ring_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_sid text NOT NULL,
  agent_id uuid REFERENCES voip_users(id) ON DELETE CASCADE,
  event_type text CHECK (event_type IN ('ring_start', 'ring_cancel', 'answered', 'declined')) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ring_events_call_sid ON ring_events(call_sid);
CREATE INDEX IF NOT EXISTS idx_ring_events_agent_id ON ring_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_ring_events_created_at ON ring_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ring_events_type ON ring_events(event_type);

ALTER TABLE ring_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ring events" ON ring_events;
CREATE POLICY "Authenticated users can read ring events" ON ring_events
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Only service role can insert ring events" ON ring_events;
CREATE POLICY "Only service role can insert ring events" ON ring_events
  FOR INSERT
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION cleanup_old_ring_events()
RETURNS void AS $$
BEGIN
  DELETE FROM ring_events
  WHERE created_at < now() - interval '24 hours';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE ring_events IS 'Real-time events for coordinating incoming call rings across multiple agents';
COMMENT ON COLUMN ring_events.call_sid IS 'Twilio Call SID';
COMMENT ON COLUMN ring_events.agent_id IS 'Agent who triggered this event';
COMMENT ON COLUMN ring_events.event_type IS 'ring_start = call starting to ring, ring_cancel = call cancelled, answered = agent picked up, declined = agent rejected';

-- Migration 3: claim_call function
-- Purpose: Atomic call claiming function
CREATE OR REPLACE FUNCTION claim_call(
  p_call_sid text,
  p_agent_id uuid
)
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION claim_call IS 'Atomically claims an incoming call for a specific agent. Returns true if claim successful, false if already claimed by another agent.';

-- Verification: Check that tables were created
SELECT 'call_claims table created' AS status FROM call_claims LIMIT 0;
SELECT 'ring_events table created' AS status FROM ring_events LIMIT 0;
SELECT 'claim_call function created' AS status WHERE claim_call('test', uuid_generate_v4()) IS NOT NULL;

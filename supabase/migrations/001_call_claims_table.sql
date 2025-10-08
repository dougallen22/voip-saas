-- Migration: Call Claims Table for Multi-Agent Race Condition Prevention
-- Purpose: Ensure only one agent can claim an incoming call
-- Date: 2025-10-07

CREATE TABLE IF NOT EXISTS call_claims (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_sid text UNIQUE NOT NULL,
  claimed_by uuid REFERENCES voip_users(id) ON DELETE SET NULL,
  claimed_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '30 seconds',
  status text CHECK (status IN ('pending', 'claimed', 'expired')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast lookups during race conditions
CREATE INDEX IF NOT EXISTS idx_call_claims_call_sid ON call_claims(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_claims_status ON call_claims(status);
CREATE INDEX IF NOT EXISTS idx_call_claims_claimed_by ON call_claims(claimed_by);

-- Auto-expire old claims function
CREATE OR REPLACE FUNCTION expire_old_claims()
RETURNS trigger AS $$
BEGIN
  UPDATE call_claims
  SET status = 'expired'
  WHERE expires_at < now() AND status = 'pending';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-expire on inserts
DROP TRIGGER IF EXISTS expire_claims_trigger ON call_claims;
CREATE TRIGGER expire_claims_trigger
AFTER INSERT ON call_claims
EXECUTE FUNCTION expire_old_claims();

-- Enable row-level security
ALTER TABLE call_claims ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read claims (for debugging)
CREATE POLICY "Anyone can read call claims" ON call_claims
  FOR SELECT
  USING (true);

-- Policy: Only service role can insert/update/delete
CREATE POLICY "Only service role can modify call claims" ON call_claims
  FOR ALL
  USING (false);

COMMENT ON TABLE call_claims IS 'Tracks which agent claimed an incoming call to prevent race conditions in multi-agent simultaneous ring';
COMMENT ON COLUMN call_claims.call_sid IS 'Twilio Call SID from incoming call';
COMMENT ON COLUMN call_claims.claimed_by IS 'User ID of agent who answered first';
COMMENT ON COLUMN call_claims.status IS 'pending = waiting for answer, claimed = answered, expired = timeout';

-- Active Calls Table
-- Tracks real-time call state across all browsers
-- This ensures all agents see the same call status instantly

CREATE TABLE IF NOT EXISTS active_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT UNIQUE NOT NULL,
  agent_id UUID REFERENCES voip_users(id) ON DELETE SET NULL,
  caller_number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ringing', 'active', 'parked', 'transferring')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_active_calls_call_sid ON active_calls(call_sid);
CREATE INDEX IF NOT EXISTS idx_active_calls_agent_id ON active_calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_active_calls_status ON active_calls(status);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_active_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER active_calls_updated_at
  BEFORE UPDATE ON active_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_active_calls_updated_at();

-- Enable Row Level Security
ALTER TABLE active_calls ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read active calls
CREATE POLICY "Allow authenticated users to read active calls"
  ON active_calls
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to insert active calls
CREATE POLICY "Allow authenticated users to insert active calls"
  ON active_calls
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow all authenticated users to update active calls
CREATE POLICY "Allow authenticated users to update active calls"
  ON active_calls
  FOR UPDATE
  TO authenticated
  USING (true);

-- Allow all authenticated users to delete active calls
CREATE POLICY "Allow authenticated users to delete active calls"
  ON active_calls
  FOR DELETE
  TO authenticated
  USING (true);

COMMENT ON TABLE active_calls IS 'Real-time call state tracking for multi-browser coordination';
COMMENT ON COLUMN active_calls.status IS 'Call status: ringing (incoming), active (answered), parked (on hold), transferring (being transferred)';

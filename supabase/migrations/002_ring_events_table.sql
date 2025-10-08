-- Migration: Ring Events Table for Multi-Agent Coordination
-- Purpose: Real-time coordination of ring events across all agents
-- Date: 2025-10-07

CREATE TABLE IF NOT EXISTS ring_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_sid text NOT NULL,
  agent_id uuid REFERENCES voip_users(id) ON DELETE CASCADE,
  event_type text CHECK (event_type IN ('ring_start', 'ring_cancel', 'answered', 'declined')) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes for real-time subscriptions and filtering
CREATE INDEX IF NOT EXISTS idx_ring_events_call_sid ON ring_events(call_sid);
CREATE INDEX IF NOT EXISTS idx_ring_events_agent_id ON ring_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_ring_events_created_at ON ring_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ring_events_type ON ring_events(event_type);

-- Enable row-level security
ALTER TABLE ring_events ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read ring events (for real-time updates)
CREATE POLICY "Authenticated users can read ring events" ON ring_events
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Policy: Only service role can insert ring events
CREATE POLICY "Only service role can insert ring events" ON ring_events
  FOR INSERT
  WITH CHECK (false);

-- Auto-cleanup old ring events (keep last 24 hours only)
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

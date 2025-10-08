-- Migration: Atomic Call Claiming Function
-- Purpose: Ensure only one agent can claim a call (race condition prevention)
-- Date: 2025-10-07

CREATE OR REPLACE FUNCTION claim_call(
  p_call_sid text,
  p_agent_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_claimed boolean;
BEGIN
  -- Try to claim the call atomically using INSERT with ON CONFLICT
  -- This ensures database-level locking prevents race conditions
  INSERT INTO call_claims (call_sid, claimed_by, status)
  VALUES (p_call_sid, p_agent_id, 'claimed')
  ON CONFLICT (call_sid) DO NOTHING
  RETURNING true INTO v_claimed;

  -- If v_claimed is NULL, the call was already claimed by someone else
  -- If v_claimed is true, we successfully claimed it
  RETURN COALESCE(v_claimed, false);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION claim_call IS 'Atomically claims an incoming call for a specific agent. Returns true if claim successful, false if already claimed by another agent.';

-- Fix active_calls table to support multi-agent ring
-- The call_sid should NOT be unique because multiple agents can have the same call ringing
-- Instead, the combination of (call_sid, agent_id) should be unique

-- Drop the existing unique constraint on call_sid
ALTER TABLE active_calls DROP CONSTRAINT IF EXISTS active_calls_call_sid_key;

-- Add composite unique constraint on (call_sid, agent_id)
-- This allows the same call to ring to multiple agents simultaneously
ALTER TABLE active_calls ADD CONSTRAINT active_calls_call_sid_agent_id_key UNIQUE (call_sid, agent_id);

COMMENT ON CONSTRAINT active_calls_call_sid_agent_id_key ON active_calls IS 'Allows same call to ring to multiple agents, but prevents duplicate entries for same call+agent combo';

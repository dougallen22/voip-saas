-- Add current_call_id column to voip_users table
-- This is CRITICAL for displaying active calls across all dashboards

ALTER TABLE voip_users ADD COLUMN IF NOT EXISTS current_call_id UUID REFERENCES calls(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_id ON voip_users(current_call_id);

COMMENT ON COLUMN voip_users.current_call_id IS 'The active call this user is currently on (NULL if not on a call)';

-- This column is updated by the claim-call API when an agent answers
-- When voip_users.current_call_id changes, Realtime UPDATE event fires
-- All browsers receive the event and refresh user cards
-- This is how other users see "Rhonda is on a call"

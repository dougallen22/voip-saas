-- Add current_call_phone_number column to voip_users table
-- This stores the phone number directly for instant display across all dashboards
-- SAME PATTERN AS PARKING LOT: Store ALL display data in the table

ALTER TABLE voip_users ADD COLUMN IF NOT EXISTS current_call_phone_number TEXT;

CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_phone_number ON voip_users(current_call_phone_number);

COMMENT ON COLUMN voip_users.current_call_phone_number IS 'The phone number of the current active call (NULL if not on a call). Stored for instant display across all dashboards without requiring JOIN queries.';

-- This column is updated by update-user-call API when a call is answered
-- When voip_users UPDATE event fires, Realtime broadcasts the phone number
-- All browsers receive the complete data and can display immediately
-- NO secondary fetch needed - this is why parking lot works instantly!

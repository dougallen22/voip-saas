-- Adds current_call_phone_number to voip_users so dashboards can react instantly
-- to realtime updates without extra joins. Backfills existing active calls.
ALTER TABLE public.voip_users
  ADD COLUMN IF NOT EXISTS current_call_phone_number text;

CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_phone_number
  ON public.voip_users (current_call_phone_number);

-- Backfill phone numbers for agents already on active calls.
UPDATE public.voip_users AS vu
SET current_call_phone_number = c.from_number
FROM public.calls AS c
WHERE vu.current_call_id = c.id
  AND (vu.current_call_phone_number IS NULL OR vu.current_call_phone_number <> c.from_number);

COMMENT ON COLUMN public.voip_users.current_call_phone_number
  IS 'Caller phone number for the agent''s current call; mirrors calls.from_number for realtime dashboards.';

-- Add daily call count columns to voip_users table
ALTER TABLE public.voip_users
ADD COLUMN IF NOT EXISTS today_inbound_calls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS today_outbound_calls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_count_reset_date DATE DEFAULT CURRENT_DATE;

-- Add index for better query performance on reset date
CREATE INDEX IF NOT EXISTS voip_users_last_count_reset_date_idx ON public.voip_users(last_count_reset_date);

-- Create function to reset daily counts
CREATE OR REPLACE FUNCTION reset_daily_call_counts()
RETURNS void AS $$
BEGIN
  UPDATE public.voip_users
  SET
    today_inbound_calls = 0,
    today_outbound_calls = 0,
    last_count_reset_date = CURRENT_DATE
  WHERE last_count_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN public.voip_users.today_inbound_calls IS 'Count of inbound calls answered today';
COMMENT ON COLUMN public.voip_users.today_outbound_calls IS 'Count of outbound calls made today';
COMMENT ON COLUMN public.voip_users.last_count_reset_date IS 'Date when counts were last reset';

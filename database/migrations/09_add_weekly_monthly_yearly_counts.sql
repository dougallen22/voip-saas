-- Add weekly, monthly, and yearly call count columns to voip_users table
ALTER TABLE public.voip_users
ADD COLUMN IF NOT EXISTS weekly_inbound_calls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_outbound_calls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_week_reset_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS monthly_inbound_calls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_outbound_calls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_month_reset_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS yearly_inbound_calls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS yearly_outbound_calls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_year_reset_date DATE DEFAULT CURRENT_DATE;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS voip_users_last_week_reset_date_idx ON public.voip_users(last_week_reset_date);
CREATE INDEX IF NOT EXISTS voip_users_last_month_reset_date_idx ON public.voip_users(last_month_reset_date);
CREATE INDEX IF NOT EXISTS voip_users_last_year_reset_date_idx ON public.voip_users(last_year_reset_date);

-- Update the reset function to handle all time periods
CREATE OR REPLACE FUNCTION reset_call_counts()
RETURNS void AS $$
BEGIN
  -- Reset daily counts (if new day)
  UPDATE public.voip_users
  SET
    today_inbound_calls = 0,
    today_outbound_calls = 0,
    last_count_reset_date = CURRENT_DATE
  WHERE last_count_reset_date < CURRENT_DATE;

  -- Reset weekly counts (if new week - Monday is start of week)
  UPDATE public.voip_users
  SET
    weekly_inbound_calls = 0,
    weekly_outbound_calls = 0,
    last_week_reset_date = CURRENT_DATE
  WHERE last_week_reset_date < DATE_TRUNC('week', CURRENT_DATE);

  -- Reset monthly counts (if new month)
  UPDATE public.voip_users
  SET
    monthly_inbound_calls = 0,
    monthly_outbound_calls = 0,
    last_month_reset_date = CURRENT_DATE
  WHERE last_month_reset_date < DATE_TRUNC('month', CURRENT_DATE);

  -- Reset yearly counts (if new year)
  UPDATE public.voip_users
  SET
    yearly_inbound_calls = 0,
    yearly_outbound_calls = 0,
    last_year_reset_date = CURRENT_DATE
  WHERE last_year_reset_date < DATE_TRUNC('year', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- Drop old function and use new one
DROP FUNCTION IF EXISTS reset_daily_call_counts();

COMMENT ON COLUMN public.voip_users.weekly_inbound_calls IS 'Count of inbound calls answered this week';
COMMENT ON COLUMN public.voip_users.weekly_outbound_calls IS 'Count of outbound calls made this week';
COMMENT ON COLUMN public.voip_users.last_week_reset_date IS 'Date when weekly counts were last reset';
COMMENT ON COLUMN public.voip_users.monthly_inbound_calls IS 'Count of inbound calls answered this month';
COMMENT ON COLUMN public.voip_users.monthly_outbound_calls IS 'Count of outbound calls made this month';
COMMENT ON COLUMN public.voip_users.last_month_reset_date IS 'Date when monthly counts were last reset';
COMMENT ON COLUMN public.voip_users.yearly_inbound_calls IS 'Count of inbound calls answered this year';
COMMENT ON COLUMN public.voip_users.yearly_outbound_calls IS 'Count of outbound calls made this year';
COMMENT ON COLUMN public.voip_users.last_year_reset_date IS 'Date when yearly counts were last reset';

-- Fix call count reset logic
-- Daily: Reset at midnight every day
-- Weekly: Reset at midnight every Sunday (start of week)
-- Monthly: Reset at midnight on the 1st of each month
-- Yearly: Reset at midnight on Jan 1st

CREATE OR REPLACE FUNCTION reset_call_counts()
RETURNS void AS $$
BEGIN
  -- Reset daily counts (if new day - date has changed)
  UPDATE public.voip_users
  SET
    today_inbound_calls = 0,
    today_outbound_calls = 0,
    last_count_reset_date = CURRENT_DATE
  WHERE last_count_reset_date < CURRENT_DATE;

  -- Reset weekly counts (if new week - Sunday is day 0)
  -- Check if we've crossed into a new week (Sunday)
  UPDATE public.voip_users
  SET
    weekly_inbound_calls = 0,
    weekly_outbound_calls = 0,
    last_week_reset_date = CURRENT_DATE
  WHERE EXTRACT(DOW FROM last_week_reset_date) > EXTRACT(DOW FROM CURRENT_DATE)
    OR (CURRENT_DATE - last_week_reset_date) >= 7;

  -- Reset monthly counts (if new month - 1st of month)
  UPDATE public.voip_users
  SET
    monthly_inbound_calls = 0,
    monthly_outbound_calls = 0,
    last_month_reset_date = CURRENT_DATE
  WHERE EXTRACT(MONTH FROM last_month_reset_date) != EXTRACT(MONTH FROM CURRENT_DATE)
    OR EXTRACT(YEAR FROM last_month_reset_date) != EXTRACT(YEAR FROM CURRENT_DATE);

  -- Reset yearly counts (if new year - Jan 1st)
  UPDATE public.voip_users
  SET
    yearly_inbound_calls = 0,
    yearly_outbound_calls = 0,
    last_year_reset_date = CURRENT_DATE
  WHERE EXTRACT(YEAR FROM last_year_reset_date) != EXTRACT(YEAR FROM CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reset_call_counts() IS 'Resets call counts at appropriate intervals: daily at midnight, weekly on Sunday midnight, monthly on 1st at midnight, yearly on Jan 1st at midnight';

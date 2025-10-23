# Call Counts Implementation

## Overview
Call statistics tracking system with automatic daily, weekly, monthly, and yearly counters stored in the `voip_users` table.

## Database Schema

### New Columns in `voip_users` Table

#### Daily Counters
- `today_inbound_calls` (INTEGER) - Inbound calls answered today
- `today_outbound_calls` (INTEGER) - Outbound calls made today
- `last_count_reset_date` (DATE) - Last daily reset date

#### Weekly Counters
- `weekly_inbound_calls` (INTEGER) - Inbound calls answered this week
- `weekly_outbound_calls` (INTEGER) - Outbound calls made this week
- `last_week_reset_date` (DATE) - Last weekly reset date

#### Monthly Counters
- `monthly_inbound_calls` (INTEGER) - Inbound calls answered this month
- `monthly_outbound_calls` (INTEGER) - Outbound calls made this month
- `last_month_reset_date` (DATE) - Last monthly reset date

#### Yearly Counters
- `yearly_inbound_calls` (INTEGER) - Inbound calls answered this year
- `yearly_outbound_calls` (INTEGER) - Outbound calls made this year
- `last_year_reset_date` (DATE) - Last yearly reset date

## How It Works

### 1. Auto-Reset Function
`reset_call_counts()` - PostgreSQL function that automatically resets counters when periods change:
- **Daily**: Resets at midnight (compares `last_count_reset_date < CURRENT_DATE`)
- **Weekly**: Resets on Monday (compares against `DATE_TRUNC('week', CURRENT_DATE)`)
- **Monthly**: Resets on 1st of month (compares against `DATE_TRUNC('month', CURRENT_DATE)`)
- **Yearly**: Resets on January 1st (compares against `DATE_TRUNC('year', CURRENT_DATE)`)

### 2. Increment on Call Answer
When a call is answered (`/api/twilio/update-user-call` with `action='start'`):
1. Calls `reset_call_counts()` to ensure all periods are current
2. Fetches call direction from `calls` table
3. Increments ALL relevant counters in a single UPDATE:
   - If `direction='inbound'`: Increments all 4 inbound counters
   - If `direction='outbound'`: Increments all 4 outbound counters

### 3. Real-Time Display
- Frontend fetches counts from `voip_users` table (no aggregation needed!)
- Supabase real-time subscription detects changes to count columns
- UI updates automatically when counts change
- Currently displays **daily** counts (IB/OB icons on agent cards)
- Weekly/monthly/yearly available for future features

## Files Modified

### Migrations
- `database/migrations/08_add_daily_call_counts.sql` - Daily counters
- `database/migrations/09_add_weekly_monthly_yearly_counts.sql` - All period counters

### API Endpoints
- `app/api/admin/add-daily-counts/route.ts` - Migration runner for daily
- `app/api/admin/add-period-counts/route.ts` - Migration runner for all periods
- `app/api/twilio/update-user-call/route.ts` - Increments counters on call answer

### Frontend
- `app/super-admin/calling/page.tsx` - Fetches and displays counts
- `components/super-admin/calling/AgentCard.tsx` - Displays IB/OB icons with counts

## Usage

### Current Display
Daily counts are shown on each agent card:
- **IB** (green circle) - Today's inbound calls
- **OB** (orange circle) - Today's outbound calls

### Future Features (Data Already Available)
Weekly, monthly, and yearly counts are being tracked and stored but not yet displayed. To use them:

```typescript
// Example: Fetch weekly counts
const { data: voipUsers } = await supabase
  .from('voip_users')
  .select('id, weekly_inbound_calls, weekly_outbound_calls')

// Example: Fetch monthly counts
const { data: voipUsers } = await supabase
  .from('voip_users')
  .select('id, monthly_inbound_calls, monthly_outbound_calls')

// Example: Fetch yearly counts
const { data: voipUsers } = await supabase
  .from('voip_users')
  .select('id, yearly_inbound_calls, yearly_outbound_calls')
```

## Benefits

1. **Performance**: No aggregation queries - counts are pre-calculated
2. **Real-Time**: Immediate updates via Supabase subscriptions
3. **Accurate**: Atomic increments prevent race conditions
4. **Scalable**: Works with any number of calls/users
5. **Flexible**: Multiple time periods for different analytics needs

## Maintenance

The system is self-maintaining:
- Counters reset automatically when periods change
- No manual intervention needed
- No background jobs required
- Reset logic runs on-demand before increments

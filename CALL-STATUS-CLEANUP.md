# Call Status Cleanup Guide

## The Problem

The "On Call" status badge is determined by checking the `current_call_id` field in the `voip_users` table in Supabase. This field should be:
- **Set** when an agent answers a call (via `/api/twilio/update-user-call` with `action: 'start'`)
- **Cleared** when the call ends (via `/api/twilio/update-user-call` with `action: 'end'`)

However, in some cases, the cleanup doesn't happen properly:

### Why Status Gets Stuck

1. **Browser Close During Call**: If you close the browser tab/window while on a call, the `disconnect` event might not fire
2. **Network Errors**: If the API request to clear status fails due to network issues
3. **Page Refresh During Call**: Refreshing the page mid-call can sometimes prevent cleanup
4. **Dev Server Restart**: Restarting the dev server while on a call prevents cleanup

### Symptoms

- User card shows "On Call" badge even after ending call
- Badge persists after browser refresh or dev server restart
- Other agents see you as "On Call" when you're not

## The Solution

### Immediate Fix: Run Cleanup Script

```bash
npm run clear-call-status
```

This script:
1. Checks `voip_users` for any records with `current_call_id` set
2. Clears all `current_call_id`, `current_call_phone_number`, and `current_call_answered_at` fields
3. Deletes all rows from `active_calls` table
4. Shows what was cleaned up

**When to run:**
- Anytime you see stuck "On Call" status
- After dev server restarts if status looks wrong
- After testing call flows
- Before important demos

### Preventive Measures

The codebase now has improved error handling:

#### Enhanced Logging (TwilioDeviceContext.tsx)

Both incoming and outbound call disconnect handlers now:
- Log critical cleanup operations with timestamps
- Show detailed error messages if API calls fail
- Warn if cleanup cannot proceed due to missing user ID

**Check browser console** after ending a call - you should see:
```
📥 CRITICAL: Clearing database on disconnect {...}
✅ Database updated - current_call_id cleared, ALL users will see call ended!
```

If you see error messages instead, run the cleanup script.

#### Automatic Cleanup

The `update-user-call` API endpoint (lines 250-335) automatically:
- Deletes ALL `active_calls` rows for the ended call
- Clears `current_call_id` for the agent
- Updates call status to 'completed'
- Broadcasts ring_cancel event to other agents

### Monitoring Tips

1. **Watch Browser Console**: Look for disconnect logs when ending calls
2. **Check Database**: Run cleanup script periodically during development
3. **Test End Call Flow**:
   - Answer a call
   - Check console for "Database updated" messages
   - End call
   - Verify "On Call" badge disappears
   - Refresh page
   - Confirm badge doesn't come back

### Alternative Cleanup Methods

#### Manual Database Query

If you have direct access to Supabase Dashboard:

```sql
-- Check current status
SELECT id, current_call_id, current_call_phone_number
FROM voip_users
WHERE current_call_id IS NOT NULL;

-- Clear all stuck statuses
UPDATE voip_users
SET current_call_id = NULL,
    current_call_phone_number = NULL,
    current_call_answered_at = NULL
WHERE current_call_id IS NOT NULL;

-- Clear active calls
DELETE FROM active_calls;
```

#### Stale Calls Cleanup

For cleaning up old "ringing" calls specifically:

```bash
npm run cleanup-calls
```

This removes active_calls older than 1 minute with status='ringing'.

## Root Cause Analysis

The fundamental issue is that **browser-based cleanup is not guaranteed**. The Twilio Voice SDK disconnect event handler runs in the browser, which means:

- If the browser crashes/closes, cleanup doesn't run
- Network issues can prevent API calls
- JavaScript errors elsewhere can block cleanup

### Future Improvements

Consider implementing:

1. **Server-Side Timeout**: Backend job that clears calls older than X minutes
2. **Heartbeat Monitoring**: Agents ping server every 30 seconds; if stopped, clear their calls
3. **RLS Policy**: Supabase RLS policy that auto-NULLs stale current_call_id
4. **Graceful Shutdown Handler**: Use `beforeunload` event to cleanup on page close

## Technical Details

### Database Schema

```sql
-- voip_users columns related to call status
current_call_id UUID NULL REFERENCES calls(id)
current_call_phone_number TEXT NULL
current_call_answered_at TIMESTAMPTZ NULL

-- active_calls table
id UUID PRIMARY KEY
call_sid TEXT NOT NULL
agent_id UUID REFERENCES voip_users(id)
caller_number TEXT
status TEXT (ringing | active | parked)
created_at TIMESTAMPTZ
```

### API Flow

**On Call Answer:**
```
1. User clicks "Accept Call"
2. TwilioDeviceContext calls acceptCall()
3. Call 'accept' event fires
4. POST /api/twilio/update-user-call { action: 'start' }
5. Database sets current_call_id
6. All agents see "On Call" status via realtime subscription
```

**On Call End:**
```
1. User clicks "End Call" or call disconnects
2. Call 'disconnect' event fires
3. POST /api/twilio/update-user-call { action: 'end' }
4. Database clears current_call_id
5. All agents see status cleared via realtime subscription
```

### Files Involved

- `lib/context/TwilioDeviceContext.tsx`: Disconnect handlers (lines 200-240, 436-481)
- `app/api/twilio/update-user-call/route.ts`: Database update logic
- `components/super-admin/calling/AgentCard.tsx`: "On Call" badge display (line 104)
- `app/api/saas-users/list/route.ts`: Fetches current_call_id (line 54)
- `scripts/check-and-clear-call-status.js`: Cleanup script

## Quick Reference

| Problem | Solution |
|---------|----------|
| "On Call" stuck after ending call | `npm run clear-call-status` |
| Multiple "ringing" calls in DB | `npm run cleanup-calls` |
| Need to verify database state | Check browser console for disconnect logs |
| Testing call flows | Run cleanup script before and after tests |
| Production deployment | Consider server-side timeout cleanup |

## Support

If cleanup script doesn't resolve the issue:
1. Check browser console for error messages
2. Verify environment variables are set (`.env.local`)
3. Confirm Supabase connection is working
4. Check if `voip_users` table has the required columns

# Realtime Sync Fix - Complete Documentation

## The Problem

**Symptom**: When one user (Doug) answers a call, other users (Rhonda) don't see the active call on their dashboard until they refresh the page. However, the parking lot feature works perfectly - when Doug parks a call, Rhonda sees it instantly.

**Why This Matters**: Multi-agent dashboards require instant visibility. If Rhonda can't see that Doug is on a call, she might try to transfer another call to him, or customers might get a worse experience due to coordination issues.

## Root Cause Analysis

We discovered **THREE separate issues** preventing realtime sync:

### Issue #1: Missing Database Columns
**Problem**: The `voip_users` table was missing two columns that the `update-user-call` endpoint tried to update:
- `current_call_phone_number` (text)
- `current_call_answered_at` (timestamptz)

**Impact**: When Doug answered a call, the database update would fail silently. The `current_call_id` never got set, so Rhonda's subscription never fired.

**How We Found It**: Created debug scripts that queried the database directly and discovered the columns didn't exist, even though migration files referenced them.

### Issue #2: Row-Level Security (RLS) Blocking Realtime Events
**Problem**: After adding the columns, database updates succeeded but Rhonda STILL didn't see updates in realtime.

**Root Cause**: Supabase Realtime only broadcasts events to users who have SELECT permission on the affected rows. The `voip_users` table had RLS enabled but no policies allowing authenticated users to see each other's rows.

**Impact**: The frontend (using the anon key) could not receive realtime events because RLS blocked them, even though the table was in the `supabase_realtime` publication.

**Diagnosis**: Created diagnostic scripts that tested subscriptions with both service role and anon keys. Service role received events, anon did not.

### Issue #3: Lingering Incoming Call UI After Hangup
**Problem**: When Doug ended a call, Rhonda's screen showed an incoming call UI that wouldn't clear without refresh.

**Root Cause**: Multi-agent ring means when Doug's Twilio Device rings, Rhonda's Device also rings. When Doug hangs up, his local Twilio state clears, but Rhonda's Device is still ringing. No event was broadcast to tell other agents "the call is over, clear your UI."

**Impact**: Confusing UX - Rhonda sees a ghost incoming call that's already ended.

## The Complete Solution

### Fix #1: Add Missing Columns to voip_users Table

**SQL to Run** (in Supabase Dashboard SQL Editor):
```sql
ALTER TABLE public.voip_users
  ADD COLUMN IF NOT EXISTS current_call_phone_number text,
  ADD COLUMN IF NOT EXISTS current_call_answered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_phone_number
  ON public.voip_users (current_call_phone_number);
```

**Files**:
- `FIX-REALTIME-SYNC.sql` - Complete SQL with exec_sql function for future migrations
- `add-columns-now.js` - Node script for automated migrations (requires exec_sql function)

**Verification**:
```bash
node test-voip-users-update.js
```
Should show the columns exist and can be updated.

### Fix #2: Disable RLS on voip_users Table

**SQL to Run**:
```sql
ALTER TABLE public.voip_users DISABLE ROW LEVEL SECURITY;
```

**Why Disable Instead of Add Policy**:
- The `voip_users` table contains no sensitive data
- All authenticated users need to see all other users for the dashboard
- Simpler than managing SELECT policies
- Realtime events now flow to all connected clients

**Alternative** (if you prefer to keep RLS enabled):
```sql
ALTER TABLE public.voip_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view all voip_users"
ON public.voip_users
FOR SELECT
TO authenticated
USING (true);
```

**Files**:
- `FIX-REALTIME-POLICIES.sql` - SQL to create RLS policies (not used in final solution)
- `diagnose-realtime.js` - Script to test if anon client can receive events
- `check-realtime-publication.js` - Verify table is in supabase_realtime publication

**Verification**:
```bash
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... node diagnose-realtime.js
```
Should show: `✅ SUCCESS! ANON client CAN receive realtime events!`

### Fix #3: Broadcast ring_cancel When Call Ends

**Code Change** in `app/api/twilio/update-user-call/route.ts`:

Added broadcast when `action === 'end'`:
```typescript
// Broadcast call ended event to clear incoming call UI on other agents' screens
const { error: ringCancelError } = await adminClient
  .from('ring_events')
  .insert({
    call_sid: pstnCallSid,
    agent_id: agentId,
    event_type: 'ring_cancel'
  })
```

**Frontend Handler** (already existed in `app/super-admin/calling/page.tsx`):
```typescript
// If caller hung up before anyone answered
if (event.event_type === 'ring_cancel') {
  console.log('🚫 Caller hung up - clearing all incoming call UIs')
  setIncomingCallMap({}) // Clear incoming call UI for all agents
}
```

**Files**:
- `app/api/twilio/update-user-call/route.ts:239-252` - Ring cancel broadcast
- `app/super-admin/calling/page.tsx:253-256` - Ring cancel handler
- `app/super-admin/calling/page.tsx:272-277` - Clear incoming call UI when current_call_id becomes null

## How It Works Now

### Answering a Call (Multi-Agent Ring → Single Agent Active)

1. **Incoming call arrives** → Twilio rings all available agents
2. **Doug clicks Answer** → `/api/twilio/claim-call` atomically claims the call
   - Deletes ALL `active_calls` rows for this call → Rhonda's screen clears incoming UI instantly
3. **Doug's Twilio Device accepts** → `/api/twilio/update-user-call` with `action: 'start'`
   - Updates `voip_users.current_call_id`, `current_call_phone_number`, `current_call_answered_at`
   - Inserts `active_calls` row with `status: 'active'`
   - Broadcasts `ring_events` with `event_type: 'answered'`
4. **Realtime events fire**:
   - Rhonda's `voip_users` subscription receives UPDATE event
   - Frontend updates UI to show Doug on an active call
   - **Result**: Rhonda sees Doug on a call INSTANTLY (no refresh!)

### Ending a Call (Active → Clear)

1. **Doug clicks End Call** → Twilio Device disconnects
2. **Disconnect event fires** → `/api/twilio/update-user-call` with `action: 'end'`
   - Deletes ALL `active_calls` for this call
   - Updates `voip_users` to set `current_call_id: null`
   - Updates `calls` table to `status: 'completed'`
   - Broadcasts `ring_events` with `event_type: 'ring_cancel'`
3. **Realtime events fire**:
   - Rhonda's `voip_users` subscription receives UPDATE with `current_call_id: null`
   - Frontend clears incoming call UI from incomingCallMap
   - Rhonda's `ring_events` subscription receives `ring_cancel`
   - Frontend clears any lingering incoming call UI
   - **Result**: Rhonda's screen clears INSTANTLY (no ghost incoming calls!)

## Why Parking Lot Always Worked

The parking lot used this exact pattern from day one:

1. **Park call** → Delete ALL `active_calls` → INSERT `parked_calls`
2. **Realtime DELETE event** → All users see active_calls disappear instantly
3. **Realtime INSERT event** → All users see parked_calls appear instantly

We replicated this pattern for active calls!

## Troubleshooting

### "Active calls still don't show up without refresh"

**Check #1**: Verify columns exist
```bash
node test-voip-users-update.js
```
Should show `current_call_phone_number` and `current_call_answered_at` columns.

**Check #2**: Verify realtime events are reaching the frontend
```bash
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... node diagnose-realtime.js
```
Should show `✅ SUCCESS! ANON client CAN receive realtime events!`

If this fails, check:
- Is RLS disabled on voip_users? Run: `ALTER TABLE public.voip_users DISABLE ROW LEVEL SECURITY;`
- Is voip_users in the publication? Run: `ALTER PUBLICATION supabase_realtime ADD TABLE public.voip_users;`

**Check #3**: Check browser console logs

When Doug answers a call, Rhonda's browser should show:
```
🔄 UNIFIED: User update detected: {...}
```

If you don't see this log, realtime subscription is not receiving events.

### "Incoming call UI lingers after call ends"

**Check**: Verify ring_cancel event is being broadcast

Server logs should show when Doug ends call:
```
✅ Broadcast ring_cancel event - all agents will clear incoming call UI
```

Rhonda's browser console should show:
```
📢 Ring event received: {event_type: "ring_cancel", ...}
🚫 Caller hung up - clearing all incoming call UIs
```

If missing, check that `update-user-call` endpoint has the ring_cancel broadcast code (lines 239-252).

## Key Files

**Database Migrations**:
- `FIX-REALTIME-SYNC.sql` - Complete SQL to add columns and exec_sql function
- `FIX-REALTIME-POLICIES.sql` - RLS policy creation (alternative to disabling RLS)

**API Endpoints**:
- `app/api/twilio/update-user-call/route.ts` - Updates voip_users, broadcasts ring events
- `app/api/twilio/claim-call/route.ts` - Atomically claims call, deletes active_calls

**Frontend**:
- `app/super-admin/calling/page.tsx:250-313` - voip_users subscription with incoming call UI clearing
- `app/super-admin/calling/page.tsx:196-265` - ring_events subscription for multi-agent coordination

**Diagnostic Scripts**:
- `test-voip-users-update.js` - Test database updates and verify columns
- `diagnose-realtime.js` - Test if anon client receives realtime events
- `check-realtime-publication.js` - Verify table is in supabase_realtime publication
- `check-voip-users-policies.js` - Check RLS policies

## Lessons Learned

1. **Supabase Realtime requires both publication AND RLS permissions**
   - Adding a table to `supabase_realtime` publication is not enough
   - Frontend clients using anon key need SELECT permission via RLS policies OR RLS disabled

2. **Multi-agent systems need explicit "call ended" events**
   - Don't rely on local Twilio Device state clearing
   - Broadcast coordination events (`ring_cancel`, `answered`, etc.) for all state changes

3. **Silent failures are the hardest to debug**
   - Database updates failing silently (missing columns) hid the real issue
   - Always add comprehensive logging to trace state changes
   - Create diagnostic scripts that test each layer (DB, realtime, frontend)

4. **Follow the working pattern**
   - Parking lot worked perfectly from day one
   - Once we replicated its pattern (DELETE all → INSERT new), active calls worked too
   - When debugging, find what works and mirror that pattern

## Future Maintenance

### Adding New Realtime-Synced Features

To add a new feature that needs realtime sync:

1. **Database**: Ensure all columns exist before deploying code that uses them
2. **RLS**: Either disable RLS or create policies allowing all authenticated users to SELECT
3. **Publication**: Verify table is in `supabase_realtime` publication
4. **Events**: Broadcast coordination events for state changes that affect multiple users
5. **Test**: Use diagnostic scripts to verify realtime events reach the frontend

### Running Future Migrations

After the initial `exec_sql` function creation, migrations can run programmatically:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://... \\
SUPABASE_SERVICE_ROLE_KEY=eyJh... \\
node your-migration-script.js
```

Your script should use:
```javascript
await supabase.rpc('exec_sql', {
  sql: 'ALTER TABLE ...'
})
```

## Credits

Fixed through systematic debugging:
1. Compared working (parking lot) vs broken (active calls) patterns
2. Created diagnostic scripts to test each layer independently
3. Fixed issues in order: DB columns → RLS/realtime → coordination events
4. Verified each fix before moving to the next issue

**Result**: Active calls now sync across all users just like parking lot! 🎉

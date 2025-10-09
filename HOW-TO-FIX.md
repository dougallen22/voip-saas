# HOW TO FIX REALTIME SYNC - QUICK START

> **📚 For complete documentation, see [REALTIME-SYNC-FIX.md](./REALTIME-SYNC-FIX.md)**

## TL;DR - The Fix

Active calls now sync across all users in realtime! Three issues were fixed:

1. ✅ **Missing database columns** - Added `current_call_phone_number` and `current_call_answered_at`
2. ✅ **RLS blocking realtime events** - Disabled Row Level Security on `voip_users` table
3. ✅ **Lingering incoming call UI** - Broadcast `ring_cancel` event when calls end

## Quick Fix Instructions

### Step 1: Add Missing Columns (60 seconds)

1. Go to: https://supabase.com/dashboard/project/zcosbiwvstrwmyioqdjw/sql/new

2. Run this SQL:

```sql
ALTER TABLE public.voip_users
  ADD COLUMN IF NOT EXISTS current_call_phone_number text,
  ADD COLUMN IF NOT EXISTS current_call_answered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_phone_number
  ON public.voip_users (current_call_phone_number);
```

### Step 2: Fix Realtime Events (30 seconds)

Run this SQL to disable RLS (voip_users has no sensitive data):

```sql
ALTER TABLE public.voip_users DISABLE ROW LEVEL SECURITY;
```

**Alternative** (if you want to keep RLS enabled):
```sql
ALTER TABLE public.voip_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view all voip_users"
ON public.voip_users
FOR SELECT
TO authenticated
USING (true);
```

### Step 3: Test It

1. Keep two browser windows open (Doug and Rhonda)
2. Answer an incoming call
3. **BOTH screens should instantly show the active call** without refresh
4. End the call
5. **BOTH screens should instantly clear** without refresh

## What Was Fixed

### Issue #1: Missing Columns
The `update-user-call` endpoint was failing silently because columns didn't exist.

### Issue #2: RLS Blocking Realtime
Even with columns added, Supabase Realtime requires SELECT permission. Frontend uses anon key, so RLS blocked events.

### Issue #3: Ghost Incoming Call UI
Multi-agent ring means other agents' Twilio Devices keep ringing after one agent answers. Now we broadcast `ring_cancel` to clear UI.

## Troubleshooting

### "Still requires refresh after Step 1"
Run Step 2 - RLS is blocking realtime events.

### "Incoming call UI lingers after hangup"
Code fix already deployed in `update-user-call` endpoint (lines 239-252).

### "Events not reaching frontend"
```bash
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... node diagnose-realtime.js
```

Should show: `✅ SUCCESS! ANON client CAN receive realtime events!`

## Complete Documentation

For detailed explanation of all three root causes, diagnostic scripts, code changes, and lessons learned:

**👉 [REALTIME-SYNC-FIX.md](./REALTIME-SYNC-FIX.md)**

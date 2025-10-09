# Active Agent Call Display - Troubleshooting History

## Problem Statement

When an agent answers a call, only that agent sees the active call card on their screen. Other users viewing the dashboard don't see the active call status without manually refreshing their browser. This is different from the parking lot feature, which shows parked calls on all screens instantly.

**Expected Behavior:** When Doug answers a call, Rhonda's screen should immediately show that Doug is on a call with the caller's phone number visible.

**Actual Behavior:**
- Doug's screen shows full call card with phone number
- Rhonda's screen shows nothing OR shows "On Call" status without phone number
- Rhonda must manually refresh to see the status

---

## Parking Lot vs Active Calls - Key Differences

### **Parking Lot (WORKS PERFECTLY)**

#### Database Structure
```sql
-- Dedicated table with ALL display data
CREATE TABLE parked_calls (
  id UUID PRIMARY KEY,
  call_id UUID,
  caller_number TEXT,  -- ✅ Phone number stored directly
  parked_by_user_id UUID,
  original_agent_id UUID,
  parked_at TIMESTAMP,
  metadata JSONB
)
```

#### API Pattern (`/api/twilio/park-call`)
```typescript
// INSERT with complete data
const { data: parkedCall } = await adminClient
  .from('parked_calls')
  .insert({
    call_id: callId,
    caller_number: callerNumber,  // ✅ ALL display data included
    parked_by_user_id: userId,
    original_agent_id: userId,
    metadata: { /* ... */ }
  })
  .select()
  .single()

console.log('✅ Parked call inserted - all screens should show it now')
```

**Key Point:** INSERT includes ALL data needed for display. No secondary queries required.

#### State Management (`/lib/stores/callParkingStore.ts`)
```typescript
// Zustand store - global reactive state
export const useCallParkingStore = create<CallParkingState>()(
  devtools((set, get) => ({
    parkedCalls: new Map(),  // ✅ Map for O(1) lookups

    addParkedCallFromDb: (dbRecord) =>
      set((state) => {
        const newMap = new Map(state.parkedCalls)
        const parkedCall: ParkedCall = {
          id: dbRecord.id,
          callerId: dbRecord.caller_number,  // ✅ Has phone number
          parkedAt: new Date(dbRecord.parked_at),
          // ... complete object
        }
        newMap.set(parkedCall.id, parkedCall)
        return { parkedCalls: newMap }
      }),
  }))
)
```

**Key Point:** Zustand Map provides instant reactive updates across all components.

#### Realtime Subscription (`/app/super-admin/calling/page.tsx`)
```typescript
supabase
  .channel('parked-calls-changes')
  .on('postgres_changes', { table: 'parked_calls', event: 'INSERT' }, (payload) => {
    console.log('🚗 NEW PARKED CALL INSERT EVENT:', payload)
    if (payload.new) {
      const realParkedCall = payload.new
      // payload.new has COMPLETE data including caller_number
      addParkedCallFromDb(realParkedCall)  // ✅ Synchronous update
    }
  })
  .subscribe()
```

**Key Point:** INSERT event includes full record with all display data. Single synchronous operation.

#### Display Logic (`/components/super-admin/calling/ParkingLot.tsx`)
```typescript
{Array.from(parkedCalls.values()).map((call) => (
  <div key={call.id}>
    <h3>{call.callerId}</h3>  {/* ✅ Data already available */}
    <p>{formatDuration(call.parkedAt)}</p>
  </div>
))}
```

**Key Point:** All data is immediately available. No conditional rendering or loading states needed.

---

### **Active Calls (DOESN'T WORK)**

#### Database Structure
```sql
-- voip_users table with foreign key reference
CREATE TABLE voip_users (
  id UUID PRIMARY KEY,
  email TEXT,
  is_available BOOLEAN,
  current_call_id UUID REFERENCES calls(id)  -- ❌ Only stores ID, not display data
)

-- calls table (separate)
CREATE TABLE calls (
  id UUID PRIMARY KEY,
  twilio_call_sid TEXT,
  from_number TEXT,  -- ❌ Phone number in different table
  to_number TEXT,
  status TEXT,
  assigned_to UUID
)
```

**Key Issue:** Display data (phone number) is in `calls` table, but reference is in `voip_users` table. Requires JOIN.

#### API Pattern (`/api/twilio/update-user-call`)
```typescript
// UPDATE with only ID reference
const { error: updateUserError } = await adminClient
  .from('voip_users')
  .update({
    current_call_id: callId  // ❌ Only ID, no display data
  })
  .eq('id', agentId)
```

**Key Issue:** UPDATE only sets the ID. Phone number must be fetched separately via JOIN.

#### State Management (`/app/super-admin/calling/page.tsx`)
```typescript
// React useState - local component state
const [users, setUsers] = useState<SaaSUser[]>([])
const [userActiveCalls, setUserActiveCalls] = useState<Record<string, any>>({})

// Async fetch with JOIN query
const fetchAllActiveCalls = async () => {
  const { data: usersWithCalls } = await supabase
    .from('voip_users')
    .select(`
      id, email, current_call_id,
      calls:current_call_id (
        id, twilio_call_sid, from_number, to_number, status, answered_at
      )
    `)
    .not('current_call_id', 'is', null)

  const callMap: Record<string, any> = {}
  usersWithCalls?.forEach((user: any) => {
    if (user.calls) {
      callMap[user.id] = user.calls  // ❌ Async operation
    }
  })
  setUserActiveCalls(callMap)
}
```

**Key Issue:** useState requires async fetch. Race condition between render and data arrival.

#### Realtime Subscription (`/app/super-admin/calling/page.tsx`)
```typescript
supabase
  .channel('saas-users-changes')
  .on('postgres_changes', { table: 'voip_users' }, (payload) => {
    console.log('🔄 User update detected:', payload)
    // payload.new only has current_call_id, NOT phone number
    fetchUsers()  // ❌ Async fetch
    fetchAllActiveCalls()  // ❌ Another async fetch
  })
  .subscribe()
```

**Key Issue:** UPDATE event only contains changed fields (current_call_id). Must make TWO async queries to get display data.

#### Display Logic (`/components/super-admin/calling/AgentCard.tsx`)
```typescript
activeCall={
  user.id === currentUserId
    ? activeCall  // Current user: Twilio Call object
    : (userActiveCalls[user.id]  // Other users: Might not be loaded yet!
        ? { parameters: { From: userActiveCalls[user.id].from_number } }
        : null)  // ❌ Renders null while fetching
}
```

**Key Issue:** Conditional rendering based on async fetch result. Shows nothing until data arrives.

---

## Summary of Differences

| Feature | Parking Lot (WORKS) | Active Calls (BROKEN) |
|---------|---------------------|----------------------|
| **Database** | Dedicated table with ALL data | Foreign key reference only |
| **API Operation** | INSERT with complete data | UPDATE with ID only |
| **Phone Number** | Stored in parked_calls table | Stored in separate calls table |
| **State Management** | Zustand Map (reactive) | useState (not reactive) |
| **Data Retrieval** | Synchronous from payload | Async JOIN query required |
| **Realtime Event** | payload.new has ALL data | payload.new has only ID |
| **Display Logic** | Direct access to data | Conditional rendering |
| **Network Requests** | 0 (data in event) | 2 (fetchUsers + fetchAllActiveCalls) |
| **Race Conditions** | None | Yes (render before fetch completes) |
| **Works Across Browsers** | ✅ Yes, instantly | ❌ No, requires refresh |

---

## Attempts to Fix

### Attempt #1: JOIN Query with fetchAllActiveCalls()

**What We Did:**
```typescript
const fetchAllActiveCalls = async () => {
  const { data: usersWithCalls } = await supabase
    .from('voip_users')
    .select(`
      id, email, current_call_id,
      calls:current_call_id (from_number, to_number, status)
    `)
    .not('current_call_id', 'is', null)

  const callMap: Record<string, any> = {}
  usersWithCalls?.forEach((user: any) => {
    if (user.calls) callMap[user.id] = user.calls
  })
  setUserActiveCalls(callMap)
}

// Subscribe to voip_users changes
.on('postgres_changes', { table: 'voip_users' }, () => {
  fetchUsers()
  fetchAllActiveCalls()  // Call both on every change
})
```

**Result:**
- ✅ Phone number displayed correctly after refresh
- ❌ Not instant across browsers (requires refresh)
- ❌ Race condition: async fetch may complete after render

**Why It Didn't Work:**
- Two async network requests on every change
- useState doesn't trigger re-renders in other browser windows
- Timing issue: component renders before fetch completes

---

### Attempt #2: Parent Call SID Fix

**Problem Discovered:**
The `callSid` received from browser is the child call (browser client), but database stores parent call SID (PSTN caller).

**What We Did:**
```typescript
// In /api/twilio/update-user-call
import twilio from 'twilio'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

// Fetch parent SID from Twilio (SAME AS PARKING LOT!)
let pstnCallSid = callSid
try {
  const call = await twilioClient.calls(callSid).fetch()
  if (call.parentCallSid) {
    pstnCallSid = call.parentCallSid
    console.log('✅ Using parent call SID:', pstnCallSid)
  }
} catch (error) {
  console.log('⚠️ Could not fetch call details, using original SID')
}

// Use parent SID to find call record
const { data: callRecord } = await adminClient
  .from('calls')
  .select('id')
  .eq('twilio_call_sid', pstnCallSid)  // ✅ Correct SID
  .single()
```

**Result:**
- ✅ Fixed database lookup (finds correct call record)
- ✅ `current_call_id` now set correctly
- ❌ Still doesn't show on other screens without refresh

**Why It Helped But Didn't Solve:**
- Fixed the underlying data issue
- But display issue still exists due to async fetch pattern

---

### Attempt #3: Add current_call_phone_number Column (FAILED)

**Strategy:** Store phone number directly in voip_users table (same pattern as parking lot).

**What We Did:**

1. **Created Migration** (`database/migrations/09_add_current_call_phone_number.sql`):
```sql
ALTER TABLE voip_users ADD COLUMN IF NOT EXISTS current_call_phone_number TEXT;
CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_phone_number
  ON voip_users(current_call_phone_number);
```

2. **Updated API** (`/api/twilio/update-user-call`):
```typescript
// Fetch full call record
const { data: fullCallRecord } = await adminClient
  .from('calls')
  .select('*')
  .eq('id', callId)
  .single()

const phoneNumber = fullCallRecord?.from_number || 'Unknown'

// Update with BOTH ID and phone number
const { error: updateUserError } = await adminClient
  .from('voip_users')
  .update({
    current_call_id: callId,
    current_call_phone_number: phoneNumber  // NEW
  })
  .eq('id', agentId)
```

3. **Updated List API** (`/api/saas-users/list`):
```typescript
return {
  id: voipUser.id,
  email: authUser?.email || 'N/A',
  current_call_id: voipUser.current_call_id,
  current_call_phone_number: voipUser.current_call_phone_number,  // NEW
}
```

4. **Updated TypeScript Interface**:
```typescript
interface SaaSUser {
  id: string
  email: string
  is_available: boolean
  current_call_id?: string
  current_call_phone_number?: string  // NEW
}
```

5. **Updated Display Logic**:
```typescript
activeCall={
  user.id === currentUserId
    ? activeCall
    : (user.current_call_phone_number  // Use phone number from user record
        ? { parameters: { From: user.current_call_phone_number } }
        : null)
}
```

6. **Simplified Subscription** (removed fetchAllActiveCalls):
```typescript
.on('postgres_changes', { table: 'voip_users' }, () => {
  fetchUsers()  // Only fetch users - phone number is in the record!
})
```

**Result:**
- ❌ **COMPLETE FAILURE** - Nothing displayed at all
- ❌ `current_call_id` never set in database
- ❌ Calls stuck in `status: 'ringing'`
- ❌ Made problem WORSE instead of better

**Why It Failed:**
1. Migration file created but NEVER executed on Supabase database
2. Column `current_call_phone_number` doesn't exist in database
3. API tries to update non-existent column, fails silently
4. Because API fails, `current_call_id` never gets set either
5. System completely broken - shows nothing on any screen

**Attempted Recovery:**
- Created script `scripts/apply-phone-number-migration.js` to apply migration
- Script failed: `TypeError: supabase.rpc(...).catch is not a function`
- Told user to run SQL manually in Supabase SQL Editor
- User frustrated: "does NOT work at all this is not tht hard I give up you cant do it"

**Rollback:**
- Reverted all phone number column code
- Deleted migration file and script
- Back to JOIN query approach (Attempt #1)
- Committed as: `dac7f96 - Revert phone number column approach`

---

## Current Status

**What's Working:**
- ✅ Parent SID fix is in place (correct Twilio call lookup)
- ✅ `current_call_id` is set correctly in database
- ✅ JOIN query fetches call details including phone number
- ✅ Phone number displays on agent cards

**What's NOT Working:**
- ❌ Other users don't see active calls without manual refresh
- ❌ Realtime updates only work for the agent who answered
- ❌ Doug's screen shows call, Rhonda's screen shows nothing

**Current Code State:**
- Back to Attempt #1 (JOIN query approach)
- No phone number column in database
- Two async fetches on every voip_users change
- Race condition still exists

---

## Why Parking Lot Works But Active Calls Don't

### The Core Issue: Data Location

**Parking Lot:**
```
parked_calls table (ALL data here)
├── id
├── caller_number ✅ (phone number)
├── parked_by_user_id
└── metadata
```
**INSERT event →** payload.new contains **EVERYTHING** → Direct display

**Active Calls:**
```
voip_users table (reference only)      calls table (display data here)
├── id                                  ├── id
└── current_call_id ❌ (just ID)        └── from_number ✅ (phone number)
```
**UPDATE event →** payload.new contains **ONLY ID** → Must JOIN → Async fetch → Race condition

### The Solution That Would Work

**Option A: Add current_call_phone_number Column (BUT APPLY MIGRATION!)**
1. Run migration SQL in Supabase SQL Editor manually
2. Verify column exists: `SELECT current_call_phone_number FROM voip_users LIMIT 1`
3. Then deploy code that uses the column
4. This mirrors parking lot pattern exactly

**Option B: Use Zustand Store for Active Calls**
1. Create `callActiveStore.ts` (like `callParkingStore.ts`)
2. Use Map for reactive state
3. Subscribe to voip_users changes
4. Fetch call details and store in Zustand Map
5. All components read from global store (instant updates)

**Option C: Realtime Event Payload Enhancement**
1. Configure Supabase to include related data in UPDATE events
2. Use triggers or computed columns
3. More complex but eliminates async fetches

---

## Key Lessons Learned

1. **Always apply migrations before deploying code that uses new columns**
   - We created migration file but never ran it
   - Code failed because column didn't exist

2. **INSERT vs UPDATE events are fundamentally different**
   - INSERT: payload.new contains full record
   - UPDATE: payload.new contains only changed fields
   - Parking lot uses INSERT (has everything)
   - Active calls use UPDATE (has only ID)

3. **Zustand Map vs useState for shared state**
   - Zustand: Global reactive state, works across components
   - useState: Local component state, requires prop drilling

4. **Synchronous vs Async data access**
   - Parking lot: Synchronous (data in event payload)
   - Active calls: Asynchronous (must fetch after event)
   - Async creates race conditions and timing issues

5. **Store display data, not just references**
   - Parking lot stores `caller_number` directly
   - Active calls store only `current_call_id` (requires JOIN)
   - Direct storage = instant display

---

## Next Steps to Actually Fix This

### Recommended Approach: Phone Number Column (Done Right)

1. **Manually Apply Migration in Supabase SQL Editor:**
```sql
ALTER TABLE voip_users ADD COLUMN IF NOT EXISTS current_call_phone_number TEXT;
CREATE INDEX IF NOT EXISTS idx_voip_users_current_call_phone_number
  ON voip_users(current_call_phone_number);
```

2. **Verify Column Exists:**
```sql
SELECT id, current_call_id, current_call_phone_number
FROM voip_users
LIMIT 1;
```

3. **Re-implement Phone Number Column Code:**
   - Update API to set both `current_call_id` AND `current_call_phone_number`
   - Update TypeScript interface
   - Update display logic to use `user.current_call_phone_number`
   - Remove `fetchAllActiveCalls()` from subscription

4. **Test Across Browsers:**
   - Doug answers call on his screen
   - Rhonda's screen should instantly show Doug on call with phone number
   - NO refresh required

### Alternative: Zustand Store Approach

1. **Create `/lib/stores/callActiveStore.ts`:**
```typescript
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface ActiveCall {
  userId: string
  callId: string
  callerNumber: string
  answeredAt: Date
}

interface CallActiveState {
  activeCalls: Map<string, ActiveCall>
  addActiveCall: (call: ActiveCall) => void
  removeActiveCall: (userId: string) => void
}

export const useCallActiveStore = create<CallActiveState>()(
  devtools((set) => ({
    activeCalls: new Map(),

    addActiveCall: (call) =>
      set((state) => {
        const newMap = new Map(state.activeCalls)
        newMap.set(call.userId, call)
        return { activeCalls: newMap }
      }),

    removeActiveCall: (userId) =>
      set((state) => {
        const newMap = new Map(state.activeCalls)
        newMap.delete(userId)
        return { activeCalls: newMap }
      }),
  }))
)
```

2. **Update Subscription to Populate Zustand:**
```typescript
.on('postgres_changes', { table: 'voip_users' }, async (payload) => {
  if (payload.new.current_call_id) {
    // Fetch call details
    const { data: call } = await supabase
      .from('calls')
      .select('from_number')
      .eq('id', payload.new.current_call_id)
      .single()

    // Update Zustand store
    addActiveCall({
      userId: payload.new.id,
      callId: payload.new.current_call_id,
      callerNumber: call?.from_number || 'Unknown',
      answeredAt: new Date()
    })
  } else {
    removeActiveCall(payload.new.id)
  }
})
```

3. **Update AgentCard to Read from Zustand:**
```typescript
const { activeCalls } = useCallActiveStore()
const activeCallData = activeCalls.get(user.id)

activeCall={
  user.id === currentUserId
    ? activeCall
    : (activeCallData
        ? { parameters: { From: activeCallData.callerNumber } }
        : null)
}
```

---

## Conclusion

The parking lot works because it stores ALL display data in a single table and uses INSERT events that include complete records. Active calls don't work because they store only a reference (ID) and use UPDATE events that require async JOIN queries.

The fix is to either:
1. Store phone number in voip_users table (parking lot pattern)
2. Use Zustand for reactive global state management
3. Fix the async fetch race condition with better state management

The phone number column approach is the cleanest solution, but requires actually applying the database migration before deploying the code.

---

## Implemented Solution (2025-10-09)

1. **Schema:** Added `database/migrations/09_add_current_call_phone_number.sql` to create `current_call_phone_number`, index it, and backfill any active agents so the realtime payload already includes caller numbers. Run this migration (or paste the SQL) in Supabase **before** deploying the updated app.
2. **API:** Updated `/api/twilio/update-user-call` to persist both `current_call_id` and the caller's number atomically (with a fallback if the migration is missing) and to clear both fields when the call ends.
3. **User Listing:** `/api/saas-users/list` now returns `current_call_phone_number` plus `current_call_answered_at`, using a lightweight join for the answered timestamp so timers still render.
4. **Client State:** Introduced `lib/stores/callActiveStore.ts` (Zustand Map) to mirror parking-lot behavior. Realtime `voip_users` events populate and clear entries instantly, while `calls` events keep answered timestamps fresh. The dashboard no longer performs extra joins or duplicate fetches.
5. **Dashboard:** `app/super-admin/calling/page.tsx` hydrates the new store during the initial load, relies on it for remote agent call cards, and keeps incoming call lists in sync via a focused `fetchRingingCalls()` helper.

**Deployment Checklist**
- Apply the migration in Supabase (SQL editor or migration runner).
- Redeploy the API/app so the new store and endpoints are active.
- Perform a two-browser test: answer a call as Agent A and confirm Agent B sees the active card immediately, then end and park the call to verify cleanup.

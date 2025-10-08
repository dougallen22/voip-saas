# Fix Multi-Agent Unpark Issue - Detailed Plan

## Problem Statement

**Current Behavior:**
When **Rhonda** (Agent 1) drags a parked call from the parking lot to **Douglas** (Agent 2):
- The call shows in the **centralized incoming call bar** (top orange bar)
- The call should ONLY show in Douglas's agent card (blue transfer card)

**Expected Behavior:**
- When YOU (Douglas) unpark to yourself → Works correctly (shows in your card only)
- When RHONDA unparks to Douglas → Should show in Douglas's card only (same behavior)

## Root Cause Analysis

### How the Code Currently Works

1. **When Douglas drags from parking lot to his own card:**
   ```
   Line 710-713: setPendingTransferTo(newAgentId)
   Line 711:     pendingTransferToRef.current = newAgentId
   currentUserId = Douglas's ID
   pendingTransferToRef.current = Douglas's ID
   ```
   - When call arrives, line 332 checks: `pendingTransferToRef.current && !processedTransferCallSids.has(callSid)`
   - ✅ TRUE → Shows transfer card in Douglas's agent card only

2. **When Rhonda drags from parking lot to Douglas's card:**
   ```
   Line 710-713: setPendingTransferTo(Douglas's ID)
   Line 711:     pendingTransferToRef.current = Douglas's ID
   currentUserId = RHONDA's ID  ← THIS IS THE PROBLEM!
   pendingTransferToRef.current = Douglas's ID
   ```
   - **THE ISSUE:** Each browser instance (Rhonda and Douglas) has its own separate React state!
   - Rhonda's browser sets `pendingTransferToRef.current = Douglas's ID`
   - Douglas's browser has `pendingTransferToRef.current = null` (never set!)
   - When call arrives at Douglas's browser, line 332 checks the ref
   - ❌ FALSE (ref is null in Douglas's browser) → Falls through to multi-agent ring logic (line 369)

### Why This Happens

**The fundamental issue:**
- `pendingTransferToRef` is **per-browser state**
- When Rhonda's browser initiates the unpark, it sets the ref in **Rhonda's browser only**
- Douglas's browser never knows about the pending transfer
- When the Twilio call rings Douglas's browser, his ref is still `null`
- So the code thinks it's a multi-agent ring, not a transfer

## Solution Approach

### Option 1: Database-Backed Transfer State (Recommended)

**Use Supabase real-time to sync pending transfers across all browsers**

#### Implementation Steps:

1. **Create a new table: `pending_transfers`**
   ```sql
   CREATE TABLE pending_transfers (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     call_sid TEXT NOT NULL,
     target_agent_id UUID NOT NULL REFERENCES voip_users(id),
     created_by_user_id UUID NOT NULL REFERENCES voip_users(id),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 minute')
   );

   CREATE INDEX idx_pending_transfers_call_sid ON pending_transfers(call_sid);
   CREATE INDEX idx_pending_transfers_target ON pending_transfers(target_agent_id);
   CREATE INDEX idx_pending_transfers_expires ON pending_transfers(expires_at);
   ```

2. **When Rhonda unparks to Douglas:**
   - Rhonda's browser calls `/api/twilio/unpark-call`
   - API inserts record into `pending_transfers`:
     ```typescript
     await supabase.from('pending_transfers').insert({
       call_sid: parkedCall.conferenceSid, // or appropriate call identifier
       target_agent_id: targetAgentId,
       created_by_user_id: currentUserId
     })
     ```

3. **Subscribe to pending_transfers in calling page:**
   ```typescript
   useEffect(() => {
     const channel = supabase
       .channel('pending-transfers')
       .on(
         'postgres_changes',
         {
           event: 'INSERT',
           schema: 'public',
           table: 'pending_transfers',
           filter: `target_agent_id=eq.${currentUserId}` // Only listen for my transfers
         },
         (payload) => {
           console.log('🎯 Pending transfer detected for me:', payload.new)
           // Set the ref when we hear about a transfer targeting us
           pendingTransferToRef.current = currentUserId
           setPendingTransferTo(currentUserId)
         }
       )
       .subscribe()

     return () => {
       supabase.removeChannel(channel)
     }
   }, [currentUserId])
   ```

4. **When call arrives at Douglas's browser:**
   - Douglas's browser now has `pendingTransferToRef.current = Douglas's ID` (set by subscription)
   - Line 332 check passes: ✅ TRUE
   - Shows transfer card in Douglas's agent card only

5. **Clean up after transfer:**
   - After processing (line 358), delete the pending_transfer record
   - Or use PostgreSQL TTL to auto-delete expired records

#### Pros:
- ✅ Works across multiple browsers/users
- ✅ No race conditions
- ✅ Persists across page refreshes
- ✅ Can track who initiated the transfer (audit trail)
- ✅ Auto-cleanup with expires_at

#### Cons:
- Requires database migration
- Slightly more complex
- Need to handle cleanup

---

### Option 2: Enhanced Call Metadata (Alternative)

**Store transfer target in the call's metadata when unparking**

#### Implementation Steps:

1. **Modify `/api/twilio/unpark-call` to store target in call metadata:**
   ```typescript
   // When creating the TwiML to ring the target agent
   const twiml = `
     <Response>
       <Dial>
         <Client>
           <Identity>${targetAgentId}</Identity>
           <Parameter name="transferTarget" value="${targetAgentId}" />
         </Client>
       </Dial>
     </Response>
   `
   ```

2. **In calling page, check incomingCall.parameters for transferTarget:**
   ```typescript
   useEffect(() => {
     if (incomingCall && !activeCall) {
       const callSid = incomingCall.parameters.CallSid
       const transferTarget = incomingCall.customParameters?.transferTarget

       // If this call has a transferTarget parameter, it's a transfer
       if (transferTarget && transferTarget === currentUserId) {
         // Show only to this agent
         setIncomingCallMap({
           [currentUserId]: {
             callSid: callSid,
             callerNumber: incomingCall.parameters.From || 'Unknown',
             twilioCall: incomingCall,
             isTransfer: true
           }
         })
       } else if (!transferTarget) {
         // Multi-agent ring
         // ... existing multi-agent logic
       }
     }
   }, [incomingCall, activeCall, currentUserId])
   ```

#### Pros:
- ✅ No database changes needed
- ✅ Simple and elegant
- ✅ Transfer info travels with the call

#### Cons:
- Need to verify Twilio Client SDK supports custom parameters
- May not persist across all Twilio operations

---

### Option 3: Ring Events Table (Simplest Fix)

**Use existing `ring_events` table to signal transfer type**

#### Implementation Steps:

1. **Modify `/api/twilio/unpark-call` to create a special ring event:**
   ```typescript
   // After initiating the unpark, create a ring event with type 'transfer'
   await supabase.from('ring_events').insert({
     call_sid: conferenceSid,
     agent_id: targetAgentId,
     event_type: 'transfer_start',
     metadata: {
       from_parking_lot: true,
       initiated_by: currentUserId
     }
   })
   ```

2. **In calling page, subscribe to ring_events for transfers:**
   ```typescript
   // Existing ring events subscription (line 283-313)
   // Add new handler for 'transfer_start' events

   useEffect(() => {
     const ringEventsChannel = supabase
       .channel('ring-events')
       .on(
         'postgres_changes',
         {
           event: 'INSERT',
           schema: 'public',
           table: 'ring_events',
           filter: `agent_id=eq.${currentUserId}`
         },
         (payload) => {
           const event = payload.new

           // NEW: Handle transfer_start events
           if (event.event_type === 'transfer_start') {
             console.log('🎯 Transfer incoming - setting pendingTransferTo')
             pendingTransferToRef.current = currentUserId
             setPendingTransferTo(currentUserId)
           }

           // ... existing ring_cancel handler
         }
       )
       .subscribe()
   }, [currentUserId])
   ```

3. **When call arrives:**
   - Douglas's browser has already set `pendingTransferToRef.current = Douglas's ID` (from ring event)
   - Line 332 check passes: ✅ TRUE
   - Shows transfer card only

#### Pros:
- ✅ Uses existing table and subscription infrastructure
- ✅ Minimal code changes
- ✅ Works across all browsers
- ✅ Already have cleanup logic for ring_events

#### Cons:
- Slight semantic overload of ring_events table
- Need to ensure ring event fires BEFORE Twilio call arrives

---

## Recommended Solution: Option 3 (Ring Events)

**Why Option 3 is best:**

1. **Reuses existing infrastructure** - Already have ring_events table and subscription
2. **Minimal changes** - Only need to:
   - Add one INSERT in `/api/twilio/unpark-call`
   - Add one handler in ring_events subscription
3. **Proven pattern** - We already use ring_events for ring_cancel coordination
4. **No migration needed** - Table already exists
5. **Automatic cleanup** - ring_events already clean themselves up

---

## Detailed Implementation Plan for Option 3

### Step 1: Modify `/api/twilio/unpark-call` Route

**File:** `/Users/dougallen/Desktop/voip/app/api/twilio/unpark-call/route.ts`

**Add BEFORE initiating the Twilio redirect:**

```typescript
// Line ~60-70 (after getting targetAgentId, before Twilio operations)

// Signal to target agent's browser that a transfer is incoming
await adminClient.from('ring_events').insert({
  call_sid: conferenceSid || 'unknown', // Use conference SID or call SID
  agent_id: targetAgentId,
  event_type: 'transfer_start'
})

console.log(`📡 Sent transfer_start ring event to agent: ${targetAgentId}`)
```

### Step 2: Update Ring Events Subscription in Calling Page

**File:** `/Users/dougallen/Desktop/voip/app/super-admin/calling/page.tsx`

**Modify lines 283-313 (ring events subscription):**

```typescript
useEffect(() => {
  if (!currentUserId) return

  console.log('📢 Subscribing to ring events for multi-agent coordination')

  const ringEventsChannel = supabase
    .channel('ring-events')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ring_events',
        filter: `agent_id=eq.${currentUserId}`
      },
      (payload) => {
        const event = payload.new as any
        console.log('🔔 Ring event received:', event)

        // NEW: Handle incoming transfer notifications
        if (event.event_type === 'transfer_start') {
          console.log('🎯 Transfer incoming - preparing to receive call in my card only')
          pendingTransferToRef.current = currentUserId
          setPendingTransferTo(currentUserId)
          console.log(`✅ Set pendingTransferToRef.current = ${currentUserId}`)
        }

        // EXISTING: If caller hung up before anyone answered
        if (event.event_type === 'ring_cancel') {
          console.log('🚫 Caller hung up - clearing all incoming call UIs')
          setIncomingCallMap({}) // Clear incoming call UI for all agents
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(ringEventsChannel)
  }
}, [currentUserId])
```

### Step 3: Test Cases

After implementation, test these scenarios:

#### Test 1: Self-unpark (should already work)
1. Douglas parks a call
2. Douglas drags call from parking lot back to his own card
3. ✅ EXPECTED: Call rings in Douglas's card only (blue transfer card)

#### Test 2: Cross-user unpark (currently broken, will be fixed)
1. Douglas parks a call
2. Rhonda drags call from parking lot to Douglas's card
3. ✅ EXPECTED: Call rings in Douglas's card only (blue transfer card)
4. ❌ SHOULD NOT: Show in centralized incoming call bar

#### Test 3: Regular incoming call (should not be affected)
1. External caller dials Twilio number
2. ✅ EXPECTED: Centralized incoming call bar shows at top
3. ✅ EXPECTED: Orange incoming call cards in both Rhonda and Douglas's agent cards

#### Test 4: Transfer button (should not be affected)
1. Rhonda receives a call
2. Rhonda clicks Transfer → clicks Douglas's card
3. ✅ EXPECTED: Call rings in Douglas's card only (blue transfer card)

### Step 4: Edge Cases to Handle

1. **Ring event arrives AFTER Twilio call:**
   - Currently unlikely due to network latency (Supabase realtime is fast)
   - If this happens: Call will show in centralized bar briefly, then move to card
   - Could add a small delay (200ms) in unpark API before redirecting Twilio call
   - Or ignore - rare edge case with minor UX impact

2. **Multiple transfers in quick succession:**
   - `pendingTransferToRef` gets overwritten
   - Should be fine - latest transfer wins
   - Could track by callSid if needed

3. **Transfer times out / agent doesn't answer:**
   - Existing 45-second timeout (line 363) handles this
   - Ring event naturally expires
   - No cleanup needed

### Step 5: Optional Improvements

1. **Add call metadata to ring event:**
   ```typescript
   await adminClient.from('ring_events').insert({
     call_sid: conferenceSid,
     agent_id: targetAgentId,
     event_type: 'transfer_start',
     metadata: {
       caller_number: callerNumber,
       from_user_id: initiatingUserId
     }
   })
   ```

2. **Clear pending transfer after processing:**
   ```typescript
   // After line 358 (after clearing pendingTransferToRef)
   // Optionally delete the ring event to prevent reprocessing
   await supabase
     .from('ring_events')
     .delete()
     .eq('call_sid', callSid)
     .eq('event_type', 'transfer_start')
     .eq('agent_id', currentUserId)
   ```

---

## Files That Need Changes

1. **`/Users/dougallen/Desktop/voip/app/api/twilio/unpark-call/route.ts`**
   - Add ring event INSERT before Twilio redirect

2. **`/Users/dougallen/Desktop/voip/app/super-admin/calling/page.tsx`**
   - Update ring events subscription handler (lines 283-313)
   - Add 'transfer_start' event handler

## Estimated Impact

- **Lines of code changed:** ~15 lines
- **New files:** 0
- **Database changes:** 0
- **Risk level:** LOW (only adds new event type, doesn't change existing logic)
- **Testing time:** 10 minutes (4 test cases)

---

## Rollback Plan

If this causes issues:

1. Remove the `event_type === 'transfer_start'` handler from calling page
2. Remove the ring event INSERT from unpark-call API
3. Deploy - system returns to current behavior

---

## Summary

**The fix is simple:**
1. When Rhonda initiates unpark to Douglas, API sends a ring event to Douglas's browser
2. Douglas's browser receives the event and sets `pendingTransferToRef.current = Douglas's ID`
3. When Twilio call arrives at Douglas's browser, the existing logic (line 332) correctly identifies it as a transfer
4. Call shows in Douglas's card only ✅

**Why this works:**
- Uses existing proven infrastructure (ring_events + Supabase realtime)
- Minimal code changes
- No database migrations
- Fixes the root cause: lack of cross-browser transfer coordination

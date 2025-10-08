# Multi-Agent Simultaneous Ring Implementation Plan

## Overview
This plan details how to implement simultaneous ring functionality where multiple available agents see incoming calls and the first agent to answer gets connected. All agents retain full call parking capabilities.

## Current State Analysis

### What Works Now
- **Single Agent Ring**: System finds ONE available agent and rings only that agent
- **Call Parking**: Any agent can park their active call
- **Call Unparking**: Any agent can retrieve a parked call
- **Real-time Updates**: Supabase subscriptions keep all agents synced
- **Drag-and-Drop Transfers**: Agents can drag calls to parking or to other agents

### Current Limitations
- **File**: `/app/api/twilio/voice/route.ts` line 32
- **Problem**: `.limit(1)` only selects ONE agent
- **Behavior**: Only first available agent's card rings
- **Impact**: Other available agents never see incoming calls

### What Needs to Change
1. Find ALL available agents (not just one)
2. Ring ALL available agents simultaneously
3. Handle race condition when first agent answers
4. Cancel rings on other agent cards when someone answers
5. Ensure parking still works for all agents

---

## Architecture Changes

### 1. Database Schema Changes

#### Add Call Claims Table (Race Condition Prevention)
```sql
CREATE TABLE call_claims (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_sid text UNIQUE NOT NULL,
  claimed_by uuid REFERENCES voip_users(id),
  claimed_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '30 seconds',
  status text CHECK (status IN ('pending', 'claimed', 'expired')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_call_claims_call_sid ON call_claims(call_sid);
CREATE INDEX idx_call_claims_status ON call_claims(status);

-- Auto-expire old claims
CREATE OR REPLACE FUNCTION expire_old_claims()
RETURNS trigger AS $$
BEGIN
  UPDATE call_claims
  SET status = 'expired'
  WHERE expires_at < now() AND status = 'pending';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER expire_claims_trigger
AFTER INSERT ON call_claims
EXECUTE FUNCTION expire_old_claims();
```

#### Add Ring Events Table (Real-time Coordination)
```sql
CREATE TABLE ring_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_sid text NOT NULL,
  agent_id uuid REFERENCES voip_users(id),
  event_type text CHECK (event_type IN ('ring_start', 'ring_cancel', 'answered', 'declined')) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for real-time subscriptions
CREATE INDEX idx_ring_events_call_sid ON ring_events(call_sid);
CREATE INDEX idx_ring_events_agent_id ON ring_events(agent_id);
```

---

### 2. Backend API Changes

#### New Endpoint: `/api/twilio/claim-call/route.ts`
**Purpose**: Atomic call claiming to prevent race conditions

```typescript
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { callSid, agentId } = await request.json()

    if (!callSid || !agentId) {
      return NextResponse.json({ error: 'Missing callSid or agentId' }, { status: 400 })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Atomic claim using database transaction
    const { data, error } = await adminClient.rpc('claim_call', {
      p_call_sid: callSid,
      p_agent_id: agentId
    })

    if (error) {
      console.error('Error claiming call:', error)
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 409 }) // Conflict - someone else claimed it
    }

    if (!data) {
      return NextResponse.json({
        success: false,
        error: 'Call already claimed by another agent'
      }, { status: 409 })
    }

    // Broadcast ring cancellation to other agents
    await adminClient.from('ring_events').insert({
      call_sid: callSid,
      agent_id: agentId,
      event_type: 'answered'
    })

    return NextResponse.json({
      success: true,
      claimedBy: agentId
    })

  } catch (error: any) {
    console.error('Error in claim-call:', error)
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}
```

#### Database Function: `claim_call`
```sql
CREATE OR REPLACE FUNCTION claim_call(
  p_call_sid text,
  p_agent_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_claimed boolean;
BEGIN
  -- Try to claim the call atomically
  INSERT INTO call_claims (call_sid, claimed_by, status)
  VALUES (p_call_sid, p_agent_id, 'claimed')
  ON CONFLICT (call_sid) DO NOTHING
  RETURNING true INTO v_claimed;

  -- Return true if we claimed it, false if already claimed
  RETURN COALESCE(v_claimed, false);
END;
$$ LANGUAGE plpgsql;
```

#### Modified: `/api/twilio/voice/route.ts`
**Change**: Remove `.limit(1)` and return TwiML that rings ALL available agents

```typescript
// BEFORE (lines 25-32):
const { data: availableAgents, error: agentError } = await adminClient
  .from('voip_users')
  .select('*')
  .is('organization_id', null)
  .eq('is_available', true)
  .in('role', ['agent', 'super_admin'])
  .limit(1)  // ❌ Only rings ONE agent

// AFTER:
const { data: availableAgents, error: agentError } = await adminClient
  .from('voip_users')
  .select('*')
  .is('organization_id', null)
  .eq('is_available', true)
  .in('role', ['agent', 'super_admin'])
  // ✅ Get ALL available agents

if (agentError || !availableAgents || availableAgents.length === 0) {
  console.log('No available agents')
  twiml.say({ voice: 'alice' }, 'All agents are currently busy. Please leave a message.')
  twiml.record({
    timeout: 3,
    transcribe: true,
    maxLength: 120
  })
  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' }
  })
}

// Create call claim record
const callSid = request.nextUrl.searchParams.get('CallSid')
await adminClient.from('call_claims').insert({
  call_sid: callSid,
  status: 'pending'
})

// Ring ALL available agents simultaneously
console.log(`📞 Ringing ${availableAgents.length} available agents:`,
  availableAgents.map(a => a.full_name).join(', '))

const dial = twiml.dial({
  timeout: 30,
  action: '/api/twilio/dial-status'  // Handle no-answer scenario
})

// Add each agent as a Client element
availableAgents.forEach(agent => {
  dial.client(agent.id)
  console.log(`  - Ringing agent: ${agent.full_name} (${agent.id})`)
})

// Broadcast ring event to all agents
for (const agent of availableAgents) {
  await adminClient.from('ring_events').insert({
    call_sid: callSid,
    agent_id: agent.id,
    event_type: 'ring_start'
  })
}
```

#### New Endpoint: `/api/twilio/dial-status/route.ts`
**Purpose**: Handle scenario where all agents timeout or decline

```typescript
import { NextResponse } from 'next/server'
import twilio from 'twilio'

export async function POST(request: Request) {
  const twiml = new twilio.twiml.VoiceResponse()

  const formData = await request.formData()
  const dialCallStatus = formData.get('DialCallStatus')
  const callSid = formData.get('CallSid')

  console.log('Dial status:', { dialCallStatus, callSid })

  if (dialCallStatus === 'no-answer' || dialCallStatus === 'failed') {
    twiml.say({ voice: 'alice' }, 'All agents are unavailable. Please leave a message.')
    twiml.record({
      timeout: 3,
      transcribe: true,
      maxLength: 120
    })
  } else if (dialCallStatus === 'completed') {
    // Call was answered - do nothing, already connected
    console.log('Call successfully connected')
  }

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' }
  })
}
```

---

### 3. Frontend Changes

#### Modified: `/app/super-admin/calling/page.tsx`

**Add ring event subscription** (after line 200):

```typescript
// Subscribe to ring events for call coordination
useEffect(() => {
  if (!currentUserId) return

  const channel = supabase
    .channel('ring-events')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ring_events',
      },
      (payload) => {
        const event = payload.new
        console.log('📢 Ring event received:', event)

        // If someone else answered, cancel our incoming ring
        if (event.event_type === 'answered' && event.agent_id !== currentUserId) {
          console.log('🚫 Another agent answered, canceling our ring')
          setIncomingCallMap({}) // Clear incoming call UI
        }

        // If call was declined by specific agent
        if (event.event_type === 'declined' && event.agent_id === currentUserId) {
          setIncomingCallMap({}) // Clear our incoming call UI
        }
      }
    )
    .subscribe()

  return () => {
    channel.unsubscribe()
  }
}, [currentUserId])
```

**Modify handleAnswerCall** (around line 249):

```typescript
const handleAnswerCall = async () => {
  if (!incomingCall || !currentUserId) return

  console.log('📞 Attempting to answer call from agent card')

  const callSid = incomingCall.parameters.CallSid

  try {
    // Try to claim the call atomically
    const claimResponse = await fetch('/api/twilio/claim-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callSid: callSid,
        agentId: currentUserId
      })
    })

    const claimResult = await claimResponse.json()

    if (!claimResult.success) {
      console.log('⚠️ Call already claimed by another agent')
      setIncomingCallMap({}) // Clear UI
      toast({
        title: 'Call Answered',
        description: 'Another agent already answered this call.',
        variant: 'default'
      })
      return
    }

    console.log('✅ Successfully claimed call, now accepting')

    // We won the race - accept the call
    await acceptCall()
    setIncomingCallMap({})

  } catch (error) {
    console.error('Error claiming call:', error)
    toast({
      title: 'Error',
      description: 'Failed to answer call. Please try again.',
      variant: 'destructive'
    })
  }
}
```

**Modify handleDeclineCall** (around line 260):

```typescript
const handleDeclineCall = async () => {
  if (!incomingCall || !currentUserId) return

  console.log('❌ Declining call from agent card')

  const callSid = incomingCall.parameters.CallSid

  // Broadcast decline event
  await supabase.from('ring_events').insert({
    call_sid: callSid,
    agent_id: currentUserId,
    event_type: 'declined'
  })

  await rejectCall()
  setIncomingCallMap({})
}
```

**Show incoming call on ALL available agent cards** (around line 549):

```typescript
{users.map((user) => {
  // Show incoming call UI if:
  // 1. There's an incoming call
  // 2. This agent is available
  // 3. This agent is not already on a call
  // 4. This agent hasn't declined it
  const shouldShowIncoming =
    incomingCall &&
    user.is_available &&
    !user.current_call_id &&
    user.id in incomingCallMap

  return (
    <AgentCard
      key={user.id}
      user={user}
      onToggleAvailability={handleToggleAvailability}
      onCall={handleCall}
      activeCall={user.id === currentUserId ? activeCall : null}
      callStartTime={user.id === currentUserId ? callStartTime : null}
      incomingCall={shouldShowIncoming ? incomingCallMap[user.id] : undefined}
      onAnswerCall={user.id === currentUserId ? handleAnswerCall : undefined}
      onDeclineCall={user.id === currentUserId ? handleDeclineCall : undefined}
    />
  )
})}
```

#### Modified: `/hooks/useTwilioDevice.ts`

**Add incoming call handler logic** (around line 80):

```typescript
device.on('incoming', async (call: Call) => {
  console.log('📞 Incoming call from:', call.parameters.From)
  console.log('Call SID:', call.parameters.CallSid)

  setIncomingCall(call)

  // Show incoming call notification
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification('Incoming Call', {
        body: `Call from ${call.parameters.From}`,
        icon: '/phone-icon.png'
      })
    }
  }

  // Play ringtone
  const audio = new Audio('/ringtone.mp3')
  audio.loop = true
  audio.play().catch(e => console.error('Failed to play ringtone:', e))

  // Stop ringtone when call ends or is answered
  call.on('accept', () => audio.pause())
  call.on('cancel', () => audio.pause())
  call.on('disconnect', () => audio.pause())
  call.on('reject', () => audio.pause())
})
```

---

### 4. Call Parking Compatibility

**CRITICAL**: All parking functionality must continue to work for all agents.

#### Verification Checklist
- ✅ Each agent can park their own active call
- ✅ Any agent can retrieve any parked call
- ✅ Parking lot shows all parked calls in real-time
- ✅ Drag-and-drop works from agent to parking lot
- ✅ Drag-and-drop works from parking lot to agent
- ✅ Database updates correctly when parking/unparking

#### No Changes Required To:
- `/app/api/twilio/park-call/route.ts` - Already works per-agent
- `/app/api/twilio/unpark-call/route.ts` - Already works per-agent
- `/components/super-admin/calling/DraggableCallCard.tsx` - Already works
- `/components/super-admin/calling/ParkingLot.tsx` - Already works
- `/stores/callParkingStore.ts` - Already works

**Why No Changes**: Parking is per-active-call, not per-agent-selection. As long as each agent can have their own active call (which they already can), parking works automatically.

---

## Failure Scenarios & Solutions

### Scenario 1: Race Condition - Two Agents Click Answer Simultaneously

**Problem**: Both agents click "Answer" at exactly the same time.

**Solution**:
- Database-level atomic claim using `claim_call()` function
- First INSERT wins due to UNIQUE constraint on `call_sid`
- Second agent gets 409 Conflict response
- Second agent's UI shows toast: "Another agent already answered this call"
- Second agent's incoming call UI clears automatically

**Test**:
```bash
# Simulate race condition with parallel curl requests
curl -X POST http://localhost:3000/api/twilio/claim-call \
  -H "Content-Type: application/json" \
  -d '{"callSid":"CA123","agentId":"agent1"}' &
curl -X POST http://localhost:3000/api/twilio/claim-call \
  -H "Content-Type: application/json" \
  -d '{"callSid":"CA123","agentId":"agent2"}' &
wait
# Only one should return success: true
```

### Scenario 2: All Agents Decline or Timeout

**Problem**: No agent answers within 30 seconds, or all agents click "Decline".

**Solution**:
- Twilio calls `/api/twilio/dial-status` with `DialCallStatus=no-answer`
- TwiML responds with voicemail prompt
- Call is recorded and stored in database
- Email notification sent to admin

**Test**:
1. Make call when 2 agents available
2. Both agents click "Decline"
3. Verify voicemail prompt plays
4. Verify recording is saved

### Scenario 3: Agent Accepts But Connection Fails

**Problem**: Agent clicks "Answer", claims call successfully, but Twilio can't connect (network issue, browser crashed, etc.)

**Solution**:
- Twilio's `<Dial>` has built-in timeout (30 seconds)
- If connection fails, `dial-status` endpoint is called with `DialCallStatus=failed`
- TwiML responds with fallback to voicemail
- Call claim is marked as expired
- Other available agents could be re-notified (optional enhancement)

**Test**:
1. Agent accepts call
2. Kill agent's browser immediately
3. Verify Twilio times out
4. Verify voicemail plays

### Scenario 4: Agent On Call Becomes Available Again

**Problem**: Agent finishes call, becomes available, but UI doesn't update.

**Solution**:
- Already handled by existing Supabase real-time subscriptions
- When call ends, `current_call_id` is set to NULL
- Real-time update triggers UI refresh
- Agent card shows "Available" again

**Test**:
1. Agent answers call
2. Call ends normally
3. Verify agent card shows "Available" within 1 second

### Scenario 5: Parked Call Retrieved During Active Incoming Ring

**Problem**: Agent A has incoming ring, Agent B retrieves parked call at same time.

**Solution**:
- Separate state management: `incomingCallMap` vs `activeCall`
- Unpark operation only affects `activeCall` state
- Incoming ring UI unaffected
- Both can coexist (agent can have incoming ring while another has active call)

**Test**:
1. Park a call
2. Make new inbound call (rings both agents)
3. While ringing, retrieve parked call to different agent
4. Verify both operations work independently

---

## Debugging Strategy

### 1. Console Logging Points

**Add detailed logs at each critical step:**

```typescript
// In /api/twilio/voice/route.ts
console.log('📞 INCOMING CALL:', {
  callSid,
  from: request.nextUrl.searchParams.get('From'),
  availableAgents: availableAgents.map(a => ({ id: a.id, name: a.full_name }))
})

// In /api/twilio/claim-call/route.ts
console.log('🎯 CLAIM ATTEMPT:', { callSid, agentId, timestamp: new Date().toISOString() })
console.log('✅ CLAIM SUCCESS:', { callSid, agentId })
console.log('❌ CLAIM FAILED:', { callSid, agentId, reason: 'already claimed' })

// In handleAnswerCall
console.log('📞 ANSWER ATTEMPT:', { callSid, agentId: currentUserId })
console.log('⚠️ CLAIM RACE LOST:', { callSid, agentId: currentUserId })
console.log('✅ ANSWER SUCCESS:', { callSid, agentId: currentUserId })

// In ring event subscription
console.log('📢 RING EVENT:', { type: event.event_type, callSid: event.call_sid, agentId: event.agent_id })
```

### 2. Database Query Monitoring

**Check call claims in real-time:**
```sql
-- See all active claims
SELECT * FROM call_claims WHERE status = 'claimed' ORDER BY claimed_at DESC;

-- See all ring events for a call
SELECT * FROM ring_events WHERE call_sid = 'CAxxxx' ORDER BY created_at;

-- Check for race conditions
SELECT call_sid, COUNT(*) as claim_attempts
FROM call_claims
GROUP BY call_sid
HAVING COUNT(*) > 1;
```

### 3. Twilio Webhook Logs

**Enable Twilio debugger:**
- Go to Twilio Console → Monitor → Debugger
- Filter by date range
- Look for:
  - Incoming call webhook hits
  - Dial action callbacks
  - Connection failures

### 4. Browser DevTools

**Network Tab Checks:**
- Verify `/api/twilio/claim-call` returns 200 (success) or 409 (conflict)
- Check Supabase real-time WebSocket connection stays open
- Monitor ring event broadcasts

**Console Tab Checks:**
- Filter by "RING", "CLAIM", "ANSWER" keywords
- Verify no JavaScript errors
- Check Twilio Device connection status

---

## Testing Plan

### Phase 1: Single Agent (Baseline - Already Works)
**Verify nothing broke:**

1. ✅ Single agent available, receives call
2. ✅ Agent answers call
3. ✅ Agent parks call
4. ✅ Agent retrieves parked call
5. ✅ Agent ends call

### Phase 2: Two Agents - Basic Simultaneous Ring

**Test Setup:**
- Create second user in database
- Both agents set to "Available"
- Both agents open dashboard in different browsers

**Test 2.1: Both See Incoming Call**
1. Make inbound call to Twilio number
2. Verify both agent cards show orange incoming call UI
3. Verify both have Answer/Decline buttons
4. **Expected**: Both cards ringing simultaneously

**Test 2.2: First Agent Answers**
1. Make inbound call
2. Agent A clicks "Answer" first
3. Verify Agent A's card shows active call with timer
4. Verify Agent B's incoming call UI disappears
5. Verify Agent B sees toast: "Another agent already answered"
6. **Expected**: Clean race condition handling

**Test 2.3: Second Agent Answers (Race Lost)**
1. Make inbound call
2. Agent B clicks "Answer" first
3. Agent A clicks "Answer" 1 second later
4. Verify Agent B gets the call
5. Verify Agent A sees "already answered" message
6. **Expected**: No errors, graceful handling

**Test 2.4: Both Decline**
1. Make inbound call
2. Both agents click "Decline"
3. Verify voicemail prompt plays
4. **Expected**: Call goes to voicemail

**Test 2.5: One Declines, Other Answers**
1. Make inbound call
2. Agent A clicks "Decline"
3. Agent B clicks "Answer"
4. Verify Agent B gets call successfully
5. **Expected**: Agent A's UI clears, Agent B connects

### Phase 3: Call Parking with Multiple Agents

**Test 3.1: Agent A Parks, Agent B Retrieves**
1. Agent A answers call
2. Agent A drags call to parking lot
3. Verify parking lot shows parked call
4. Agent B drags parked call from parking lot to their card
5. Verify Agent B now has active call
6. **Expected**: Seamless transfer

**Test 3.2: Park During Incoming Ring**
1. Make inbound call (both agents ring)
2. Agent A has a separate active call already
3. Agent A parks their active call while incoming ring continues
4. Agent B answers incoming call
5. Verify both calls tracked correctly
6. **Expected**: No state conflicts

**Test 3.3: Retrieve While Ringing**
1. Park a call
2. Make new inbound call (both agents ring)
3. While ringing, Agent A retrieves parked call
4. Agent B answers incoming call
5. Verify both calls active on different agents
6. **Expected**: Independent operations work

### Phase 4: Stress Testing

**Test 4.1: Rapid Sequential Calls**
1. Make 5 calls in a row, 5 seconds apart
2. Different agents answer each
3. Verify no state leakage between calls
4. **Expected**: Each call independent

**Test 4.2: Simultaneous Answer Spam**
1. Make inbound call
2. Both agents spam click "Answer" button 10 times
3. Verify only one agent gets call
4. Verify no JavaScript errors
5. **Expected**: Database atomic claim handles it

**Test 4.3: Network Interruption**
1. Agent A answers call
2. Disconnect Agent A's network
3. Verify call drops gracefully
4. Verify database updates correctly
5. **Expected**: No orphaned call records

### Phase 5: Multi-Agent Parking Combinations

**Test 5.1: Three Agents - Park Chain**
1. Add third agent
2. Agent A answers call
3. Agent A parks call
4. Agent B retrieves call
5. Agent B parks call
6. Agent C retrieves call
7. **Expected**: Full parking chain works

**Test 5.2: All Agents Have Active Calls**
1. Three agents each have active calls
2. All calls parked simultaneously
3. Each agent retrieves different parked call
4. **Expected**: No conflicts, clean swaps

---

## Migration Steps (In Order)

### Step 1: Database Schema
```bash
# Run SQL migrations
psql $DATABASE_URL -f migrations/001_call_claims_table.sql
psql $DATABASE_URL -f migrations/002_ring_events_table.sql
psql $DATABASE_URL -f migrations/003_claim_call_function.sql
```

### Step 2: Backend APIs
1. Create `/api/twilio/claim-call/route.ts`
2. Create `/api/twilio/dial-status/route.ts`
3. Modify `/api/twilio/voice/route.ts` (remove `.limit(1)`)

### Step 3: Frontend - Dashboard
1. Add ring events subscription to `page.tsx`
2. Modify `handleAnswerCall` with claim logic
3. Modify `handleDeclineCall` with broadcast
4. Update agent card rendering logic

### Step 4: Frontend - Hook
1. Add better incoming call handling to `useTwilioDevice.ts`
2. Add ringtone playback
3. Add browser notifications

### Step 5: Testing
1. Run Phase 1 tests (baseline verification)
2. Run Phase 2 tests (two agents)
3. Run Phase 3 tests (parking compatibility)
4. Fix any issues found
5. Run Phase 4 & 5 stress tests

### Step 6: Documentation
1. Update CALL-PARKING.md with multi-agent notes
2. Add troubleshooting section for race conditions
3. Document claim_call database function

---

## Rollback Plan

**If something goes wrong:**

1. **Database**: Keep tables but don't use them (no data loss)
2. **Backend**: Revert `voice/route.ts` to add `.limit(1)` back
3. **Frontend**: Remove ring event subscription
4. **Result**: Back to single-agent mode, parking still works

**Rollback Command:**
```sql
-- Disable multi-agent without dropping tables
ALTER TABLE call_claims DISABLE TRIGGER ALL;
ALTER TABLE ring_events DISABLE TRIGGER ALL;
```

Then revert `/api/twilio/voice/route.ts` to use `.limit(1)`.

---

## Success Criteria

✅ **Multi-agent ring works**:
- Multiple available agents see incoming call simultaneously
- First agent to answer gets the call
- Other agents' UIs update immediately

✅ **Race conditions handled**:
- No duplicate answers
- No orphaned calls
- Clean error messages

✅ **Call parking preserved**:
- All agents can park calls
- All agents can retrieve parked calls
- No conflicts between parking and multi-ring

✅ **Stable in production**:
- No console errors
- No database deadlocks
- Real-time updates within 1 second

✅ **Well documented**:
- MULTI-AGENT.md exists
- All failure scenarios documented
- Testing checklist complete

---

## Timeline Estimate

- **Database Setup**: 30 minutes
- **Backend APIs**: 2 hours
- **Frontend Changes**: 2 hours
- **Testing Phase 1-2**: 1 hour
- **Testing Phase 3-5**: 2 hours
- **Documentation**: 1 hour
- **Buffer for bugs**: 2 hours

**Total**: ~10 hours over 2-3 days

---

## Notes

- This plan assumes parking is already working (it is - verified in CALL-PARKING.md)
- All changes are additive - nothing breaks existing single-agent flow
- Database atomic operations prevent race conditions at the lowest level
- Real-time Supabase subscriptions handle UI coordination
- Twilio's native `<Dial>` with multiple `<Client>` elements handles simultaneous ring
- Each agent still has their own Twilio Device instance (no changes needed)

**Critical Files to Watch**:
- `/app/api/twilio/voice/route.ts` - Most important change (remove limit 1)
- `/app/super-admin/calling/page.tsx` - Handle claim logic
- Database migration files - Get schema right first time

**This plan is ULTRA HARD THOUGHT** ✅

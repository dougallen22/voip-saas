# Unified Calling Dashboard - Architecture

## Problem
Current system has **separate Twilio Device state per browser**, causing sync issues:
- Doug's browser has Doug's Twilio Device with Doug's calls
- Rhonda's browser has Rhonda's Twilio Device with Rhonda's calls
- They try to sync via database but it's complex and error-prone

## Solution: ONE Shared Database-Driven Dashboard

### Key Principle
**All call state lives in the database. All users see the same view from database.**

### How It Works

#### 1. Database as Single Source of Truth
```
calls table:
- id
- twilio_call_sid
- from_number
- to_number
- status (ringing, active, parked, ended)
- assigned_to (which agent has it)
- answered_at
- ended_at

voip_users table:
- id
- current_call_id (FK to calls)
- is_available
```

#### 2. All Users See Same View
```typescript
// Every browser queries the SAME data:
const { data: allCalls } = await supabase
  .from('calls')
  .select('*, assigned_to_user:voip_users!assigned_to(*)')
  .in('status', ['ringing', 'active', 'parked'])

// Show calls in UI:
- Ringing calls → show in "Incoming Calls" section
- Active calls → show in agent's card (assigned_to)
- Parked calls → show in "Parking Lot"
```

#### 3. Realtime Updates ALL Browsers
```typescript
supabase
  .channel('unified-calls')
  .on('postgres_changes', { table: 'calls' }, () => {
    // Refresh the calls list for ALL users
    fetchAllCalls()
  })
```

#### 4. Actions Update Database
When Doug clicks "Answer Call":
```typescript
// Update database
await supabase
  .from('calls')
  .update({
    status: 'active',
    assigned_to: dougId,
    answered_at: new Date()
  })
  .eq('id', callId)

// Update Doug's user record
await supabase
  .from('voip_users')
  .update({ current_call_id: callId })
  .eq('id', dougId)

// Realtime fires → ALL browsers refresh → ALL see Doug on call
```

#### 5. Twilio Device Still Used (But Simplified)
- Each browser still has Twilio Device for AUDIO ONLY
- Twilio Device accepts/rejects/holds calls
- BUT all UI state comes from DATABASE
- When call events happen, update database immediately

### New UI Flow

#### Incoming Call
1. Twilio webhook → creates call record with `status='ringing'`
2. Database insert → Realtime fires
3. ALL browsers show call in "Incoming Calls" section (not per-agent)

#### Someone Answers
1. Doug clicks "Answer" → updates database `assigned_to=Doug, status=active`
2. Doug's browser calls `twilioDevice.acceptCall()` for audio
3. Database update → Realtime fires
4. ALL browsers refresh → show call in Doug's card
5. ALL browsers remove from "Incoming Calls" section

#### Parking Lot
1. Drag call to parking lot → update `status='parked', assigned_to=null`
2. Database update → Realtime fires
3. ALL browsers show in parking lot
4. ALL browsers remove from agent card

### Benefits
✅ Single source of truth (database)
✅ All users see identical view
✅ No race conditions or sync issues
✅ Simpler logic - query database, show results
✅ Realtime keeps everyone in sync automatically

### Implementation Steps
1. Simplify calling dashboard to query `calls` table
2. Show ALL ringing calls in shared "Incoming Calls" section
3. Show active calls in agent cards based on `assigned_to`
4. Subscribe to `calls` table changes, refresh on any update
5. Keep Twilio Device for audio only (accept/reject/hold)

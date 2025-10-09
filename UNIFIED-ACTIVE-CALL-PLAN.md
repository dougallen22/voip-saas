# Plan: Unify Active Call Display Across All Users

## Goal
Make ALL users see the same rich active call panel (like ActiveCallPanel.tsx) when ANY user is on a call, not just a basic green card. This ensures consistent UX and full feature visibility across the dashboard.

## Current State Analysis

### What Works (Realtime Sync) ✅
The realtime sync we just fixed ensures:
1. **Database Updates Work**: When Doug answers a call, `voip_users.current_call_id` is updated
2. **Realtime Events Flow**: All users receive the UPDATE event instantly (RLS disabled)
3. **Store Updates Work**: `callActiveStore` maintains active calls for all users
4. **Data is Available**: Each user's active call data is in the store with:
   - `callId`: Database call ID
   - `callSid`: Twilio call SID (optional)
   - `callerNumber`: Phone number
   - `answeredAt`: Timestamp

### What's Missing (UI Display) ❌
**Doug (the agent on the call)** sees:
- Full-featured `MultiCallCard` or `DraggableCallCard`
- Shows: Caller, duration timer, Transfer button, End Call button, drag-to-park
- Located in AgentCard.tsx lines 221-267

**Rhonda (other users)** sees:
- Just a basic status indicator showing "On Call"
- NO call details, NO buttons, NO interaction
- Misses the rich call panel completely

## Root Cause
The `AgentCard.tsx` component has **TWO DIFFERENT CODE PATHS**:

### Path 1: Current User's Active Call (Doug's view)
```tsx
// Lines 27, 41-46: Props for current user only
activeCall?: any                    // Twilio Call object (LOCAL only)
callStartTime?: Date | null         // Local start time
activeCalls?: CallState[]           // Multi-call array (LOCAL only)
onHoldCall?: (callSid: string) => void
onResumeCall?: (callSid: string) => void
onEndCall?: (callSid: string) => void
onTransfer?: (callSid: string, callerNumber: string) => void

// Lines 221-267: Renders rich UI when these props exist
{activeCalls.length > 0 && onHoldCall && onResumeCall && onEndCall && (
  <MultiCallCard ... />
)}
```

### Path 2: Remote User's Active Call (Rhonda's view of Doug)
```tsx
// Line 23: Only has current_call_id flag
current_call_id?: string

// Lines 107-117: Just shows status text
{user.current_call_id && 'On Call'}

// NO CALL DETAILS RENDERED
```

## The Problem
The `activeCall`, `callStartTime`, `activeCalls`, and action props are **ONLY passed to the current user's card**.

Look at `calling/page.tsx` lines 936-983:
```tsx
{users.map(user => {
  const remoteActiveCall = activeCallsByUser.get(user.id)  // ✅ We HAVE the data!

  return (
    <AgentCard
      activeCall={
        user.id === currentUserId
          ? activeCall           // ✅ Current user: Full Twilio Call object
          : (remoteActiveCall    // ❌ Remote user: Fake object with just From number
              ? { parameters: { From: remoteActiveCall.callerNumber || 'Unknown' } }
              : null)
      }
      callStartTime={
        user.id === currentUserId
          ? callStartTime        // ✅ Current user: Real start time
          : remoteActiveCall?.answeredAt ?? null  // ✅ Remote: From store!
      }
      // ❌ These are NEVER passed for remote users:
      activeCalls={user.id === currentUserId ? activeCalls : undefined}
      onHoldCall={user.id === currentUserId ? holdCall : undefined}
      onResumeCall={user.id === currentUserId ? resumeCall : undefined}
      onEndCall={user.id === currentUserId ? endCall : undefined}
      onTransfer={user.id === currentUserId && !transferMode?.active ? handleInitiateTransfer : undefined}
    />
  )
})}
```

**Key Insight**: We already have `remoteActiveCall` with all the data! We just don't render it properly.

## The Solution Strategy

### Phase 1: Update the Data Layer (callActiveStore.ts)
**No changes needed!** ✅ The store already provides everything:
- `callId`, `callSid`, `callerNumber`, `answeredAt`

### Phase 2: Create a New Unified Call Display Component
**Goal**: Replace both `DraggableCallCard` and `MultiCallCard` with a single component that works for:
- Current user (full interactive features)
- Remote users (read-only display)

**New Component**: `UnifiedActiveCallCard.tsx`

**Features**:
```tsx
interface UnifiedActiveCallCardProps {
  // Data (works for both local and remote)
  callerId: string
  callerName?: string
  answeredAt: Date

  // Interaction (only for current user)
  isCurrentUser: boolean
  onEndCall?: () => void
  onTransfer?: () => void
  onHold?: () => void
  onResume?: () => void

  // Dragging (only for current user)
  isDraggable: boolean
  callObject?: any
  agentId: string
  agentName: string
}
```

**UI States**:
1. **Current User (isCurrentUser=true)**:
   - Show all buttons (Transfer, End Call, Hold/Resume)
   - Enable drag-to-park
   - Live duration timer from `answeredAt`

2. **Remote User (isCurrentUser=false)**:
   - Show call details (caller, duration)
   - Show agent name ("On call with Doug")
   - NO buttons (read-only)
   - NO dragging
   - Visual indicator: "Active Call" with green pulse

### Phase 3: Update AgentCard.tsx
**Changes**:

1. **Remove the conditional logic** (lines 221-267):
   ```tsx
   // DELETE THIS:
   {activeCalls.length > 0 && onHoldCall && onResumeCall && onEndCall && (
     <MultiCallCard ... />
   )}

   // DELETE THIS TOO:
   {activeCalls.length === 0 && (isOnCall || activeCall) && activeCall && callStartTime && (
     <DraggableCallCard ... />
   )}
   ```

2. **Add unified rendering logic**:
   ```tsx
   // NEW: Single path for ALL active calls (local and remote)
   {(activeCall || user.current_call_id) && (
     <UnifiedActiveCallCard
       callerId={activeCall?.parameters?.From || remoteActiveCall?.callerNumber || 'Unknown'}
       answeredAt={callStartTime || remoteActiveCall?.answeredAt || new Date()}
       isCurrentUser={user.id === currentUserId}
       onEndCall={user.id === currentUserId ? () => activeCall?.disconnect() : undefined}
       onTransfer={user.id === currentUserId && onTransfer ? () => onTransfer(...) : undefined}
       isDraggable={user.id === currentUserId}
       callObject={user.id === currentUserId ? activeCall : null}
       agentId={user.id}
       agentName={user.full_name}
     />
   )}
   ```

### Phase 4: Update calling/page.tsx
**Changes**:

1. **Keep passing `activeCall` and `callStartTime` for BOTH cases**:
   ```tsx
   <AgentCard
     activeCall={
       user.id === currentUserId
         ? activeCall  // Local Twilio object
         : remoteActiveCall  // From store (for display)
           ? { parameters: { From: remoteActiveCall.callerNumber || 'Unknown' } }
           : null
     }
     callStartTime={
       user.id === currentUserId
         ? callStartTime
         : remoteActiveCall?.answeredAt ?? null
     }
     // KEEP passing these for current user
     onTransfer={user.id === currentUserId && !transferMode?.active ? handleInitiateTransfer : undefined}
   />
   ```

2. **Remove unused multi-call props** (no longer needed):
   - `activeCalls` (we only support single call per agent)
   - `selectedCallId`
   - `onHoldCall`, `onResumeCall`, `onEndCall` (moved to component)

### Phase 5: Preserve Realtime Sync (CRITICAL!)
**What NOT to touch**:

1. ✅ **Keep ALL voip_users subscriptions** (`calling/page.tsx` lines 250-320)
   - These trigger `upsertActiveCall(newRow)` and `removeActiveCallForUser(newRow.id)`
   - This updates the `callActiveStore`
   - **DO NOT MODIFY**

2. ✅ **Keep ALL ring_events subscriptions** (`calling/page.tsx` lines 507-576)
   - These handle ring_cancel and coordination
   - **DO NOT MODIFY**

3. ✅ **Keep ALL active_calls subscriptions** (`calling/page.tsx` lines 404-485)
   - These sync active call state
   - **DO NOT MODIFY**

4. ✅ **Keep update-user-call endpoint exactly as-is**
   - All the realtime sync fixes we just implemented
   - Broadcasts ring_cancel
   - Updates voip_users columns
   - **DO NOT MODIFY**

## Implementation Steps (Ordered)

### Step 1: Create UnifiedActiveCallCard.tsx ✅
- Copy structure from ActiveCallPanel.tsx (the agent version)
- Add props for local vs remote display
- Add conditional rendering for buttons
- Add drag-to-park functionality (only for current user)
- Timer based on `answeredAt` prop (works for both local and remote)

### Step 2: Update AgentCard.tsx ✅
- Import UnifiedActiveCallCard
- Remove MultiCallCard and DraggableCallCard logic
- Add single unified rendering path
- Test that current user sees full features
- Test that remote users see read-only display

### Step 3: Update calling/page.tsx Props ✅
- Simplify AgentCard props (remove multi-call stuff)
- Keep activeCall and callStartTime for both local and remote
- Verify remoteActiveCall data flows correctly

### Step 4: Test Realtime Sync ✅
- Doug answers call → Doug sees full panel ✅
- Doug answers call → Rhonda sees Doug's panel (read-only) ✅
- Doug ends call → Both screens clear ✅
- Rhonda answers different call → Doug sees Rhonda's panel ✅

### Step 5: Test Edge Cases ✅
- Refresh during active call → Both users still see call ✅
- Multiple users on calls → Each card shows correct call ✅
- Transfer call → UI updates correctly ✅
- Park call → UI clears and parking lot updates ✅

## Success Criteria

✅ **Visual Consistency**: All users see the same rich call panel design
✅ **Feature Parity**: Remote users see all call details (caller, duration, agent)
✅ **Interaction Safety**: Only current user can control the call (buttons hidden for others)
✅ **Realtime Sync**: Everything updates instantly (no regressions)
✅ **Drag-to-Park**: Only current user can drag (others see static display)
✅ **Duration Accuracy**: Timer shows correct elapsed time for all users

## Risks & Mitigations

### Risk 1: Breaking Realtime Sync
**Mitigation**:
- DO NOT touch any subscription code
- DO NOT modify update-user-call endpoint
- DO NOT change store logic
- ONLY change UI rendering in AgentCard

### Risk 2: Twilio Call Object Not Available for Remote Users
**Mitigation**:
- Use store data (`remoteActiveCall`) for display
- Only current user needs real Twilio Call object (for disconnect, hold, etc.)
- Fake Call object is fine for remote display: `{ parameters: { From: callerNumber } }`

### Risk 3: Duration Timer Sync Issues
**Mitigation**:
- Use `answeredAt` timestamp (synced via realtime)
- Calculate elapsed time on frontend: `Math.floor((now - answeredAt) / 1000)`
- Same logic for current user and remote users

### Risk 4: Breaking Drag-to-Park
**Mitigation**:
- Only make current user's card draggable
- Use `useDraggable` conditionally based on `isCurrentUser`
- Remote users see static card (no drag listeners)

## Files to Modify

1. ✅ `components/super-admin/calling/UnifiedActiveCallCard.tsx` (NEW)
2. ✅ `components/super-admin/calling/AgentCard.tsx` (MODIFY)
3. ✅ `app/super-admin/calling/page.tsx` (MODIFY - props only)

## Files NOT to Touch

1. ❌ `app/api/twilio/update-user-call/route.ts` - Realtime sync endpoint
2. ❌ `lib/stores/callActiveStore.ts` - Store is already perfect
3. ❌ Any subscription code in `calling/page.tsx` (lines 250-505)

## Testing Checklist

### Before Making Changes
- [ ] Document current behavior (video/screenshots)
- [ ] Verify realtime sync works (Doug answers → Rhonda sees update)
- [ ] Note exact line numbers of subscription code (for reference)

### After Each Step
- [ ] Step 1: Component renders correctly in isolation
- [ ] Step 2: AgentCard shows UnifiedActiveCallCard for current user
- [ ] Step 3: Props flow correctly from calling/page.tsx
- [ ] Step 4: Realtime sync still works (no regressions)
- [ ] Step 5: All edge cases pass

### Final Validation
- [ ] Two browsers open (Doug and Rhonda)
- [ ] Doug answers call → Both see rich panel
- [ ] Doug can control (buttons work)
- [ ] Rhonda sees read-only (no buttons)
- [ ] Duration updates in real-time on both screens
- [ ] End call → Both screens clear instantly
- [ ] Repeat for Rhonda answering → Doug sees her call

## Rollback Plan

If anything breaks:
1. Revert to last commit: `git reset --hard HEAD~1`
2. Identify which file caused the issue
3. Fix in isolation
4. Re-apply changes incrementally

## Summary

**What we're doing**: Creating a unified active call display that shows the same rich UI to all users.

**How it works**:
- Current user sees full interactive panel (Transfer, End Call, drag-to-park)
- Remote users see same design but read-only (no buttons, no drag)
- Data comes from `callActiveStore` (already synced via realtime)
- NO changes to realtime sync logic (it's perfect as-is)

**Why it's safe**:
- We're only changing UI rendering (AgentCard component)
- Store and subscriptions remain untouched
- Realtime sync foundation is solid (just fixed it!)
- One-way data flow: Store → Component (no feedback loops)

**The key insight**: We already HAVE the data flowing correctly. We just need to RENDER it the same way for all users. This is purely a UI refactor, not a data flow change.

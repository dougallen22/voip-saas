# Restore Point Instructions

## Current Safe State ✅

**Date Created**: 2025-10-09
**Commit**: `d98a3e1` - "Add plan for unified active call display across all users"
**Git Tag**: `working-realtime-sync-v1`
**Backup Branch**: `backup/before-unified-call-display`

### What's Working Right Now
✅ **Realtime sync is fully functional** - All users see active calls instantly without refresh
✅ **Ring cancel events work** - Ghost incoming calls are cleared properly
✅ **Parking lot works perfectly** - Instant sync when calls are parked/unparked
✅ **Multi-agent ring works** - All available agents see incoming calls
✅ **Transfer works** - Calls transfer correctly between agents
✅ **RLS properly configured** - Disabled on voip_users for realtime events
✅ **Database columns present** - current_call_phone_number, current_call_answered_at exist

### What We're About to Change
🔄 **Unified active call display** - Make all users see the same rich call panel

---

## How to Restore (If Something Goes Wrong)

### Option 1: Quick Rollback (Recommended)

If you just made changes and need to undo them:

```bash
# 1. Discard all uncommitted changes
git checkout .
git clean -fd

# 2. Go back to the last safe commit
git reset --hard working-realtime-sync-v1

# 3. Force push if you already pushed bad changes
git push --force-with-lease origin main
```

### Option 2: Restore from Backup Branch

If you need to completely restore from the backup:

```bash
# 1. Switch to backup branch
git checkout backup/before-unified-call-display

# 2. Create a new main branch from backup
git branch -D main
git checkout -b main

# 3. Force push to replace main
git push --force-with-lease origin main
```

### Option 3: Selective File Restore

If only specific files broke:

```bash
# Restore AgentCard.tsx from safe point
git checkout working-realtime-sync-v1 -- components/super-admin/calling/AgentCard.tsx

# Restore calling page from safe point
git checkout working-realtime-sync-v1 -- app/super-admin/calling/page.tsx

# Commit the restoration
git add .
git commit -m "Restore files to working state"
```

---

## Verification After Restore

After restoring, verify everything works:

### 1. Check Git State
```bash
git log --oneline -3
# Should show:
# d98a3e1 Add plan for unified active call display across all users
# d47bb1c Document realtime sync fix with comprehensive inline comments
# ebf65ae Fix: Broadcast ring_cancel when call ends
```

### 2. Check Files Exist
```bash
ls -la REALTIME-SYNC-FIX.md
ls -la HOW-TO-FIX.md
ls -la components/super-admin/calling/AgentCard.tsx
```

### 3. Test Realtime Sync
- [ ] Open two browser windows (Doug and Rhonda)
- [ ] Doug answers incoming call
- [ ] Rhonda's screen shows Doug on call **instantly** (no refresh)
- [ ] Doug ends call
- [ ] Both screens clear **instantly**

### 4. Test Ring Cancel
- [ ] Incoming call rings both Doug and Rhonda
- [ ] Doug answers
- [ ] Rhonda's incoming call UI clears immediately (no ghost call)

### 5. Test Parking Lot
- [ ] Doug parks a call
- [ ] Rhonda sees it in parking lot **instantly**
- [ ] Rhonda retrieves the call
- [ ] Doug sees it disappear from parking lot **instantly**

---

## Key Files in This Safe State

### Database Schema
- ✅ `voip_users` has `current_call_phone_number` column
- ✅ `voip_users` has `current_call_answered_at` column
- ✅ `voip_users` has RLS **DISABLED**

### Backend
- ✅ `app/api/twilio/update-user-call/route.ts` - Broadcasts ring_cancel, updates voip_users
- ✅ All realtime sync fixes with inline comments

### Frontend
- ✅ `app/super-admin/calling/page.tsx` - Subscriptions to voip_users, ring_events, active_calls
- ✅ `components/super-admin/calling/AgentCard.tsx` - Current working display logic
- ✅ `lib/stores/callActiveStore.ts` - Store syncing active calls

### Documentation
- ✅ `REALTIME-SYNC-FIX.md` - Complete documentation of all three fixes
- ✅ `HOW-TO-FIX.md` - Quick start guide
- ✅ `UNIFIED-ACTIVE-CALL-PLAN.md` - Plan for upcoming changes

---

## What NOT to Restore (Keep New Changes)

If you restore but want to keep certain new improvements:

**Good to keep (if working)**:
- New UI components that don't break functionality
- Documentation improvements
- Code comments
- Styling changes

**Must restore if broken**:
- Subscription code in `calling/page.tsx`
- Store logic in `callActiveStore.ts`
- API endpoint `update-user-call/route.ts`
- Any realtime sync logic

---

## Emergency Contact Points

### Check if Realtime Sync is Broken

**Symptom**: Active calls only show after page refresh

**Diagnosis**:
```bash
# 1. Check RLS is disabled
node diagnose-realtime.js
# Should show: ✅ SUCCESS! ANON client CAN receive realtime events!

# 2. Check columns exist
node test-voip-users-update.js
# Should show: current_call_phone_number and current_call_answered_at
```

**Fix**: Restore `update-user-call/route.ts` and subscription code

### Check if Ring Cancel is Broken

**Symptom**: Ghost incoming calls after someone answers

**Diagnosis**: Look for ring_cancel broadcast in server logs when call ends

**Fix**: Restore `update-user-call/route.ts` lines 252-270 (ring_cancel broadcast)

---

## Commit Reference

### Last 5 Working Commits
```
d98a3e1 - Add plan for unified active call display across all users
d47bb1c - Document realtime sync fix with comprehensive inline comments
ebf65ae - Fix: Broadcast ring_cancel when call ends
7dba23d - Fix realtime sync - disable RLS and clear incoming call UI
2c70fb1 - Install @types/pg for TypeScript compatibility
```

### Safe Restore Points
1. **working-realtime-sync-v1** (tag) - Current safe state
2. **backup/before-unified-call-display** (branch) - Full backup branch
3. **d98a3e1** (commit) - Same as tag, plan commit

---

## Testing Script (After Restore)

Run this complete test to verify everything works:

```bash
# Terminal 1 - Start dev server
npm run dev

# Browser 1 - Doug (dougallen1020@gmail.com)
# Browser 2 - Rhonda (rhonda@example.com)

# Test 1: Incoming call sync
# - Make test call
# - Both should see incoming call
# - One answers
# - Other's UI clears immediately ✅

# Test 2: Active call sync
# - Doug answers call
# - Rhonda sees "Doug: On Call" immediately ✅
# - Doug ends call
# - Both screens clear immediately ✅

# Test 3: Ring cancel
# - Incoming call rings both
# - Doug answers
# - Rhonda's incoming call UI disappears (no ghost) ✅

# Test 4: Parking lot
# - Doug parks a call
# - Rhonda sees it in parking lot instantly ✅
# - Rhonda drags to her card
# - Doug sees it disappear from parking lot ✅
```

---

## Success Criteria

After restore, ALL of these must be true:

✅ No TypeScript errors (`npm run build` succeeds)
✅ Realtime sync works (no refresh needed)
✅ Ring cancel clears ghost calls
✅ Parking lot syncs instantly
✅ No console errors in browser
✅ No 500 errors in server logs
✅ Database columns exist (check with test script)
✅ RLS disabled on voip_users (check with diagnose script)

---

## Notes

- The backup branch will remain in the repository forever (don't delete it!)
- The tag `working-realtime-sync-v1` is immutable (safe reference point)
- Main branch can be force-pushed if needed (we have backups)
- All diagnostic scripts are in the repository root

**Remember**: The realtime sync took days to fix. Don't delete these restore points!

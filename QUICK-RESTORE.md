# QUICK RESTORE REFERENCE

## 🚨 IF THINGS BREAK - RUN THIS IMMEDIATELY

### Latest Version (Recommended - with unified call display):
```bash
# 1. Undo all changes
git checkout .
git clean -fd

# 2. Go back to latest working state
git reset --hard unified-call-display-v1

# 3. Force push if needed
git push --force-with-lease origin main

# 4. Restart dev server
npm run dev
```

### Previous Version (simpler state - before unified display):
```bash
# 1. Undo all changes
git checkout .
git clean -fd

# 2. Go back to previous working state
git reset --hard working-realtime-sync-v1

# 3. Force push if needed
git push --force-with-lease origin main

# 4. Restart dev server
npm run dev
```

## ✅ Test After Restore

### Test Unified Call Display (Latest Version):
Open two browsers:
- Doug answers call → Rhonda sees RICH CARD with phone number, duration, "Remote" badge
- Doug parks call → Shows "Parked by: Doug Allen" (not Unknown)
- Rhonda answers call → Audio connects immediately

If this works, you're on the latest! ✅

### Test Basic Realtime (Previous Version):
Open two browsers:
- Doug answers call → Rhonda sees it instantly (just "On Call" text)
- Doug ends call → Both screens clear instantly

If this works, you're back to the safe state! ✅

## 📚 Full Instructions

See `RESTORE-POINT-INSTRUCTIONS.md` for complete details.

## 🏷️ Safe Points

### Latest (Recommended):
- **Tag**: `unified-call-display-v1`
- **Branch**: `backup/after-unified-call-display`
- **Commit**: `137b8b0`

### Previous:
- **Tag**: `working-realtime-sync-v1`
- **Branch**: `backup/before-unified-call-display`
- **Commit**: `d98a3e1`

---

**Updated**: 2025-10-09
**Latest State**: Unified call display + audio fix + all realtime features ✅

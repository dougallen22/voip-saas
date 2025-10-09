# QUICK RESTORE REFERENCE

## 🚨 IF THINGS BREAK - RUN THIS IMMEDIATELY

```bash
# 1. Undo all changes
git checkout .
git clean -fd

# 2. Go back to working state
git reset --hard working-realtime-sync-v1

# 3. Force push if needed
git push --force-with-lease origin main

# 4. Restart dev server
npm run dev
```

## ✅ Test After Restore

Open two browsers:
- Doug answers call → Rhonda sees it instantly (no refresh)
- Doug ends call → Both screens clear instantly

If this works, you're back to the safe state! ✅

## 📚 Full Instructions

See `RESTORE-POINT-INSTRUCTIONS.md` for complete details.

## 🏷️ Safe Points

- **Tag**: `working-realtime-sync-v1`
- **Branch**: `backup/before-unified-call-display`
- **Commit**: `d98a3e1`

---

**Created**: 2025-10-09
**App State**: Realtime sync working perfectly ✅

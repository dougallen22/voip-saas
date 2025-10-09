# Testing Claim-Call Flow

## Current Problem
ALL calls remain `status='ringing'` and `assigned_to=null` in the database.
This means the claim-call API is NOT being executed when calls are answered.

## Test Steps

### 1. Check if latest code is deployed
- Latest commit: 067acae "Fix TypeScript error - add userIdRef for event handlers"
- Check Vercel deployment status

### 2. Test claim-call API directly
Open browser console when you answer a call and look for:
```
📞 Claiming call in database: { callSid: "CAxxxx", agentId: "uuid" }
✅ Call claimed in database - all dashboards will now sync!
```

If you DON'T see these logs, the code isn't deployed yet.

### 3. Manual test of claim-call API
You can test the API manually with curl after making a call:

```bash
# Get the most recent call SID from database
curl -X POST https://voip-saas.vercel.app/api/twilio/claim-call \
  -H "Content-Type: application/json" \
  -d '{"callSid":"CAb0c92d4d6919bc3f2ed36b3e38a9607f","agentId":"1781c3ad-b7bb-46d3-bce7-e098ae97e8a0"}'
```

This should return `{"success":true}` and update the database.

### 4. Verify database after manual test
```sql
SELECT id, status, assigned_to, current_call_id
FROM calls
WHERE twilio_call_sid = 'CAb0c92d4d6919bc3f2ed36b3e38a9607f';

SELECT id, current_call_id
FROM voip_users
WHERE id = '1781c3ad-b7bb-46d3-bce7-e098ae97e8a0';
```

Should show:
- calls.assigned_to = agent ID
- calls.status = 'active'
- voip_users.current_call_id = call ID

## Expected Flow (When Fixed)

1. Call comes in → Twilio rings both browsers
2. Doug clicks green "Accept" button
3. Twilio fires 'accept' event in Doug's browser
4. useTwilioDevice hook calls /api/twilio/claim-call
5. API updates database:
   - calls.assigned_to = Doug
   - calls.status = 'active'
   - voip_users.current_call_id = call_id
6. Supabase Realtime broadcasts UPDATE to Rhonda's browser
7. Rhonda's screen shows Doug on call

## Why It's Not Working

Possible causes:
1. ❌ Vercel hasn't deployed latest code yet (067acae)
2. ❌ Browser cache - need hard refresh (Cmd+Shift+R)
3. ❌ The 'accept' event isn't firing
4. ❌ The fetch call is failing silently
5. ❌ CORS or auth issue with the API

## Next Steps

1. Wait for Vercel deployment to complete
2. Hard refresh BOTH browsers (Cmd+Shift+R)
3. Make a new call
4. Check browser console for claim-call logs
5. If still not working, I need to see the console logs to debug further

# Twilio Voice Integration Setup

## Phase 3 - Twilio Voice Integration Complete! ✅

### What We've Built:

1. **Twilio Webhook Endpoints:**
   - `/api/twilio/voice` - Handles incoming calls
   - `/api/twilio/wait` - Hold music while waiting
   - `/api/twilio/assign-agent` - Routes calls to available agents
   - `/api/twilio/call-status` - Tracks call completion
   - `/api/twilio/call-events` - Tracks call events (answered, in-progress, etc.)

2. **Database Updates:**
   - Added `twilio_call_sid` column to `calls` table
   - Run this SQL in Supabase SQL Editor:
   ```sql
   ALTER TABLE calls ADD COLUMN IF NOT EXISTS twilio_call_sid TEXT;
   CREATE INDEX IF NOT EXISTS idx_calls_twilio_call_sid ON calls(twilio_call_sid);
   ```

3. **Environment Variables:**
   - ✅ TWILIO_ACCOUNT_SID
   - ✅ TWILIO_AUTH_TOKEN
   - ⚠️  TWILIO_PHONE_NUMBER (needs your real Twilio number)

---

## Setup Instructions:

### Step 1: Get a Twilio Phone Number

1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Buy a phone number (if you don't have one)
3. Copy the phone number (format: +1234567890)
4. Update `.env.local`:
   ```
   TWILIO_PHONE_NUMBER=+15551234567
   ```

### Step 2: Configure Webhook URLs in Twilio

Configure your Twilio phone number to point to your production Vercel deployment:

1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
2. Click on your phone number
3. Scroll to "Voice Configuration"
4. Set **"A CALL COMES IN"** to:
   - **Webhook**: `https://voip-saas.vercel.app/api/twilio/voice`
   - **HTTP POST**

### Step 3: Run the Database Migration

1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/zcosbiwvstrwmyioqdjw/sql
2. Run this SQL:
   ```sql
   ALTER TABLE calls ADD COLUMN IF NOT EXISTS twilio_call_sid TEXT;
   CREATE INDEX IF NOT EXISTS idx_calls_twilio_call_sid ON calls(twilio_call_sid);
   ```

### Step 4: Add Phone Numbers to Agents (Optional)

For phone-based calling, agents need phone numbers in their user metadata:

1. Go to Supabase Auth: https://supabase.com/dashboard/project/zcosbiwvstrwmyioqdjw/auth/users
2. Click on a user
3. Under "User Metadata", add:
   ```json
   {
     "phone_number": "+15551234567",
     "full_name": "Agent Name"
   }
   ```

---

## How It Works:

### Incoming Call Flow:

1. **Customer calls your Twilio number**
2. Twilio sends webhook to `/api/twilio/voice`
3. System greets caller and plays hold music
4. System finds an available agent from database
5. Creates call record in `calls` table
6. Marks agent as unavailable
7. Dials agent's phone number (if configured)
8. When call ends, updates call status and marks agent available again

### Call Tracking:

- All calls are logged in the `calls` table
- Call status updates in real-time via Supabase subscriptions
- Agent dashboard shows incoming calls automatically
- Call duration and timestamps are tracked

---

## Next Steps:

After completing the above setup, you can:

1. **Test the Integration:**
   - Call your Twilio number
   - Watch the logs to see the call flow
   - Agent should see the call in their dashboard

2. **Implement Browser-Based Calling:**
   - Use Twilio Client SDK for browser calls
   - Allows agents to answer calls in the web app
   - No phone number required for agents

3. **Add Call Recording:**
   - Enable recording in Twilio webhooks
   - Store recording URLs in database
   - Display recordings in call history

4. **Add Call Analytics:**
   - Track call volume
   - Monitor agent performance
   - Generate reports

---

## Testing Checklist:

- [ ] Twilio phone number configured with production webhook URL
- [ ] TwiML app configured with production webhook URL
- [ ] Database migration run successfully
- [ ] TWILIO_PHONE_NUMBER set in .env.local
- [ ] NEXT_PUBLIC_APP_URL set to https://voip-saas.vercel.app
- [ ] Code deployed to Vercel
- [ ] Test call to Twilio number
- [ ] Check Vercel logs for webhook calls
- [ ] Verify call appears in database
- [ ] Verify agent sees call in dashboard

---

## Troubleshooting:

**Calls not being received:**
- Check Twilio webhook URL is set to https://voip-saas.vercel.app/api/twilio/voice
- Check Vercel deployment logs for errors
- Verify phone number format (+1234567890)

**Agent not being assigned:**
- Ensure at least one agent has `is_available = true`
- Check database queries in server logs
- Verify agent phone number in user metadata

**Call status not updating:**
- Check status callback webhooks are configured
- Verify call events endpoint is receiving data
- Check for errors in `/api/twilio/call-status` logs

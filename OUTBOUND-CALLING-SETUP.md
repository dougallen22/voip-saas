# Outbound Calling Setup Guide

## Overview

This guide explains how to configure and use the outbound calling feature that allows agents to call contacts/leads directly from the VoIP CRM application.

## Architecture

### How It Works

1. **Agent clicks "Call" button** on a contact card
2. **Frontend** calls `makeOutboundCall(phoneNumber, contactName)` from `useTwilioDevice` hook
3. **Twilio Voice SDK** initiates connection via `device.connect()`
4. **Twilio** requests TwiML from `/api/twilio/outbound` endpoint
5. **Backend** creates call record in database and returns TwiML to dial the number
6. **Twilio** dials the number and sends status updates to `/api/twilio/outbound-events`
7. **Database** tracks call progress (ringing → in-progress → completed)
8. **UI** updates in real-time via React state and Supabase subscriptions

---

## Prerequisites

✅ Twilio account with:
- Account SID
- Auth Token
- API Key & Secret
- Phone number
- TwiML App SID

✅ Database migrations:
- `direction` column added to `calls` table
- `assigned_to` column added to `calls` table

✅ Environment variables configured in `.env.local`

---

## Step 1: Twilio Console Configuration

### Configure TwiML App for Outbound Calls

The TwiML App tells Twilio where to request instructions when an outbound call is initiated.

1. **Go to TwiML Apps:**
   - https://console.twilio.com/us1/develop/voice/manage/twiml-apps

2. **Select your TwiML App:**
   - Find the app with SID: `AP6c81208fb7dee20adb235fddfa85defb`
   - Click to edit

3. **Configure Voice URL:**
   - **Voice Request URL:** `https://YOUR-DOMAIN.vercel.app/api/twilio/outbound`
   - **HTTP Method:** POST
   - **Status Callback URL:** (leave blank, handled in TwiML)

4. **Save changes**

### For Local Development (Using ngrok)

1. **Install ngrok:**
   ```bash
   brew install ngrok  # Mac
   # OR download from https://ngrok.com
   ```

2. **Start your dev server:**
   ```bash
   npm run dev
   ```

3. **Start ngrok in another terminal:**
   ```bash
   ngrok http 3003
   ```

4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

5. **Update TwiML App Voice URL:**
   - `https://abc123.ngrok.io/api/twilio/outbound`

6. **Test calls through ngrok URL**

---

## Step 2: Environment Variables

Ensure your `.env.local` has all required variables:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_API_KEY=your_api_key_here
TWILIO_API_SECRET=your_api_secret_here
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_TWIML_APP_SID=your_twiml_app_sid_here

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# App URL (for production)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## Step 3: Database Setup

The following columns are required in the `calls` table:

### Check if columns exist:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'calls'
AND column_name IN ('direction', 'assigned_to');
```

### Add missing columns (if needed):

```sql
-- Add direction column
ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound', 'outbound'));

CREATE INDEX IF NOT EXISTS calls_direction_idx ON public.calls(direction);

-- Add assigned_to column
ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS calls_assigned_to_idx ON public.calls(assigned_to);
```

---

## Step 4: Testing Outbound Calls

### Test Checklist

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Open the app:**
   - Navigate to: http://localhost:3003
   - Log in as an agent

3. **Go to Contacts page:**
   - Click "Contacts" in navigation
   - Find or create a test contact

4. **Initiate a call:**
   - Click the green "Call" button on a contact card
   - OR open contact details and click "Call"

5. **Verify call flow:**
   - ✅ Console logs show "Initiating outbound call"
   - ✅ Phone rings for the contact
   - ✅ Call connects and audio works both ways
   - ✅ Call duration displays in UI
   - ✅ Agent status shows "On Call" for other users
   - ✅ Call appears in database with `direction: 'outbound'`

6. **End the call:**
   - Hang up from either side
   - ✅ Call status updates to "completed"
   - ✅ Agent status returns to "Available"
   - ✅ Call history shows the call with correct duration

---

## Step 5: Monitoring and Debugging

### Check Twilio Logs

1. **Go to Twilio Console Logs:**
   - https://console.twilio.com/us1/monitor/logs/calls

2. **Filter by:**
   - Date/time of test call
   - Your Twilio phone number
   - Status (completed, failed, busy, etc.)

3. **Look for:**
   - Request to `/api/twilio/outbound` (should be 200 OK)
   - TwiML response (should contain `<Dial>` verb)
   - Call connection status
   - Any error messages

### Check Application Logs

**Dev Server Console:**
```bash
# Look for these log messages:
📞 Initiating outbound call to: xxx-xxx-xxxx Contact: John Doe
=== OUTBOUND CALL REQUEST ===
CallSid: CAxxxx
To: +1xxxxxxxxxx
Contact Name: John Doe
============================
📤 Returning TwiML to dial: +1xxxxxxxxxx
```

**Browser Console:**
```javascript
// Check for:
- "Call initiated, CallSid: CAxxxx"
- "Call is ringing..."
- "Call accepted (answered)"
- "Call disconnected"
```

### Check Database

```sql
-- View recent outbound calls
SELECT
  id,
  from_number,
  to_number,
  direction,
  status,
  duration,
  answered_by_user_id,
  created_at
FROM calls
WHERE direction = 'outbound'
ORDER BY created_at DESC
LIMIT 10;

-- Check agent's current call status
SELECT
  id,
  current_call_id,
  current_call_phone_number,
  is_available
FROM voip_users
WHERE id = 'YOUR_AGENT_ID';
```

---

## Common Issues and Solutions

### Issue 1: "Device not ready"

**Symptom:** Error message when clicking Call button

**Solution:**
1. Check browser console for Twilio Device errors
2. Verify `/api/twilio/token` endpoint returns valid token
3. Ensure TwiML App SID is configured in environment variables
4. Refresh the page to reinitialize the device

### Issue 2: Call connects but no audio

**Symptom:** Call connects but neither party can hear

**Solution:**
1. Check browser permissions for microphone
2. Test with different browser (Chrome recommended)
3. Check Twilio Console → Voice → Settings → Regional settings
4. Verify firewall allows WebRTC traffic (UDP ports 10000-20000)

### Issue 3: "Invalid phone number format"

**Symptom:** Error when initiating call

**Solution:**
1. Ensure phone number is in correct format:
   - xxx-xxx-xxxx (US)
   - +1xxxxxxxxxx (E.164)
   - (xxx) xxx-xxxx (US)
2. Check phone number validation in contact form
3. Verify `formatToE164()` function works correctly

### Issue 4: Call fails immediately

**Symptom:** Call shows "failed" status instantly

**Solution:**
1. Check Twilio Console logs for error details
2. Verify Twilio phone number has voice capabilities
3. Ensure Twilio account has sufficient credits
4. Check TwiML App Voice URL is correct
5. Verify the destination number is valid and not blocked

### Issue 5: Agent status stuck "On Call"

**Symptom:** Agent shows as on call after call ends

**Solution:**
1. Check `/api/twilio/outbound-status` logs
2. Verify database trigger/subscription updates `current_call_id`
3. Manually clear status:
   ```sql
   UPDATE voip_users
   SET current_call_id = NULL,
       current_call_phone_number = NULL,
       is_available = true
   WHERE id = 'AGENT_ID';
   ```

---

## API Endpoints Reference

### POST `/api/twilio/outbound`

**Purpose:** Handles outbound call TwiML requests from Twilio

**Request Parameters (FormData):**
- `CallSid`: Twilio call SID
- `To`: Destination phone number
- `contactName`: Name of contact being called
- `From`: Agent user ID (identity)

**Response:** TwiML XML with `<Dial>` verb

**Example TwiML:**
```xml
<Response>
  <Dial callerId="+18775196150" action="/api/twilio/outbound-status?callId=123">
    <Number statusCallback="/api/twilio/outbound-events?callId=123">+15551234567</Number>
  </Dial>
</Response>
```

---

### POST `/api/twilio/outbound-status`

**Purpose:** Handles call completion status

**Request Parameters (FormData):**
- `DialCallStatus`: completed, busy, no-answer, failed, canceled
- `DialCallDuration`: Call duration in seconds
- `CallSid`: Twilio call SID

**Query Parameters:**
- `callId`: Database call record ID

**Updates:**
- Call status in database
- Agent availability status
- Call end time and duration

---

### POST `/api/twilio/outbound-events`

**Purpose:** Tracks real-time call events

**Request Parameters (FormData):**
- `CallStatus`: ringing, in-progress, completed, etc.
- `CallSid`: Twilio call SID
- `Timestamp`: Event timestamp

**Query Parameters:**
- `callId`: Database call record ID

**Updates:**
- Call status for each event
- Answered timestamp when call connects
- Agent's current_call_id

---

## Phone Number Formatting

The application automatically formats phone numbers to E.164 format (+1XXXXXXXXXX) for Twilio.

**Accepted input formats:**
- `xxx-xxx-xxxx` → `+1xxxxxxxxxx`
- `(xxx) xxx-xxxx` → `+1xxxxxxxxxx`
- `xxxxxxxxxx` → `+1xxxxxxxxxx`
- `+1xxxxxxxxxx` → `+1xxxxxxxxxx` (no change)

**Validation:**
- Must be 10 digits (US) or 11 digits starting with 1
- Invalid formats throw clear error messages
- Formatting happens before Twilio API call

---

## Security Considerations

1. **Row Level Security (RLS):**
   - Ensure RLS policies allow agents to create/update calls
   - Verify organization_id filtering is correct

2. **Token Expiration:**
   - Tokens automatically refresh every 3.5 hours
   - Device handles `tokenWillExpire` events

3. **Call Authorization:**
   - Only authenticated agents can make calls
   - Agent user ID tracked in call records
   - Organization isolation enforced

4. **Rate Limiting:**
   - Consider implementing rate limits for outbound calls
   - Monitor for abuse/excessive calling

---

## Production Deployment

### Vercel Deployment

1. **Deploy to Vercel:**
   ```bash
   vercel deploy --prod
   ```

2. **Update TwiML App Voice URL:**
   - Change from ngrok URL to production URL
   - `https://voip-saas.vercel.app/api/twilio/outbound`

3. **Verify environment variables:**
   - All Twilio variables set in Vercel dashboard
   - NEXT_PUBLIC_APP_URL points to production domain

4. **Test outbound calling:**
   - Make test call from production
   - Monitor Vercel logs for errors
   - Check Twilio Console for webhook calls

---

## Support

**Need help?**
- Check Twilio Console logs
- Review browser console for errors
- Check Supabase database logs
- Review this documentation

**Common Resources:**
- Twilio Voice SDK Docs: https://www.twilio.com/docs/voice/sdks/javascript
- Twilio TwiML Reference: https://www.twilio.com/docs/voice/twiml
- Next.js API Routes: https://nextjs.org/docs/api-routes/introduction

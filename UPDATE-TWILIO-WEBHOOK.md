# Update Twilio Webhook URL - URGENT

## ✅ ngrok is Running
Your public URL: **https://8e636ff86b1b.ngrok-free.app**

## 🚨 Action Required: Update Twilio Console

You need to update your Twilio phone number webhook URL to point to ngrok:

### Step 1: Go to Twilio Console
https://console.twilio.com/us1/develop/phone-numbers/manage/incoming

### Step 2: Find Your Number
Look for: **+1 (877) 519-6150**

### Step 3: Update Voice Webhook
1. Click on the phone number
2. Scroll to **Voice Configuration** section
3. Find **A Call Comes In** webhook field
4. Change it to:
   ```
   https://8e636ff86b1b.ngrok-free.app/api/twilio/voice
   ```
5. Make sure HTTP method is **POST**
6. Click **Save**

### Step 4: Test
Call your number: **+1 (877) 519-6150**
- The call should now connect to your local dev server
- You should see incoming call logs in your terminal
- The call should ring your agents

## Current Setup
✅ Local server running: http://localhost:3000
✅ ngrok tunnel active: https://8e636ff86b1b.ngrok-free.app
✅ Webhook responding: https://8e636ff86b1b.ngrok-free.app/api/twilio/voice
⚠️ Twilio console: **NEEDS UPDATE**

## Important Notes
- This ngrok URL is temporary (changes when ngrok restarts)
- Keep ngrok running while testing
- Don't close the ngrok process
- If you restart ngrok, you'll need to update Twilio again with the new URL

## Quick Test
You can test the webhook is working:
```bash
curl -X POST https://8e636ff86b1b.ngrok-free.app/api/twilio/voice \
  -d "CallSid=TEST123" \
  -d "From=+15555551234" \
  -d "To=+15555555678"
```

Should return TwiML XML.

# Fix Twilio Error 11200 - Webhook Not Accessible

## Problem
When you call into the app, Twilio returns error **11200** which means Twilio cannot reach your webhook endpoint at `http://localhost:3000/api/twilio/voice`.

## Root Cause
Your local development server is running on `localhost:3000`, which is only accessible on your local machine. Twilio's servers cannot reach `localhost` URLs.

## Solution: Use ngrok to Expose Your Local Server

### Step 1: Install ngrok
```bash
# Using Homebrew (macOS)
brew install ngrok

# Or download from https://ngrok.com/download
```

### Step 2: Authenticate ngrok (one-time setup)
```bash
# Sign up at https://ngrok.com and get your authtoken
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

### Step 3: Start Your Next.js Server
```bash
npm run dev
# Server runs on http://localhost:3000
```

### Step 4: Start ngrok Tunnel (in a new terminal)
```bash
ngrok http 3000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

### Step 5: Update Twilio Webhook URL

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**
3. Click on your VoIP phone number
4. Scroll to **Voice Configuration**
5. Update **A Call Comes In** webhook to:
   ```
   https://YOUR-NGROK-URL.ngrok-free.app/api/twilio/voice
   ```
   Example: `https://abc123.ngrok-free.app/api/twilio/voice`
6. Set HTTP method to **POST**
7. Click **Save**

### Step 6: Test
- Call your Twilio number
- The call should now connect to your local dev server
- Check the terminal logs for incoming call events

## Alternative: Twilio CLI

You can also use Twilio CLI which automatically sets up ngrok:

```bash
# Install Twilio CLI
npm install -g twilio-cli

# Login
twilio login

# Start tunnel
twilio phone-numbers:update YOUR_TWILIO_NUMBER --voice-url="http://localhost:3000/api/twilio/voice"
```

## Important Notes

1. **ngrok URL changes** every time you restart ngrok (free tier)
   - You'll need to update the Twilio webhook URL each time
   - Consider upgrading to ngrok paid tier for static URLs

2. **Keep ngrok running** while developing
   - Don't close the ngrok terminal
   - If you restart ngrok, update the Twilio webhook URL again

3. **Production Deployment**
   - Deploy your app to a hosting provider (Vercel, Railway, etc.)
   - Use the production URL for Twilio webhooks
   - Production URLs are permanent

## Verification

Test that your webhook is publicly accessible:
```bash
curl -X POST https://YOUR-NGROK-URL.ngrok-free.app/api/twilio/voice \
  -d "CallSid=TEST123" \
  -d "From=+15555551234" \
  -d "To=+15555555678"
```

You should see TwiML XML response.

## Current Status
✅ Webhook works locally: `http://localhost:3000/api/twilio/voice`
❌ Not publicly accessible to Twilio
✅ Solution: Use ngrok to expose local server

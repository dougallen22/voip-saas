# Rollback Points

This document tracks stable states of the application that can be safely rolled back to.

---

## v1.0-stable-calling (Current - October 23, 2025)

**Git Tag:** `v1.0-stable-calling`
**Commit:** `355e8c8`

### ✅ Working Features:
- ✅ **Inbound calls** - Calls to +18775196150 successfully ring agents
- ✅ **Outbound calls** - Click-to-call from contacts page works
- ✅ **No "all agents busy" error** - Fixed webhook configuration
- ✅ **Contact management** - Full CRUD operations working
- ✅ **Call parking** - Park and retrieve calls functional
- ✅ **Call transfers** - Transfer calls between agents
- ✅ **Multi-agent calling** - Multiple agents can receive calls
- ✅ **Real-time updates** - Supabase subscriptions working

### 🔧 Configuration:
- **Twilio Phone Webhook:** `https://voip-saas.vercel.app/api/twilio/voice`
- **TwiML App Webhook:** `https://voip-saas.vercel.app/api/twilio/outbound`
- **Phone Number:** +18775196150
- **Database:** Supabase (zcosbiwvstrwmyioqdjw.supabase.co)
- **Deployment:** Vercel (voip-saas.vercel.app)
- **No ngrok required** - All webhooks point to production

### 📦 Key Changes from Previous State:
- Removed all ngrok references and dependencies
- Fixed hardcoded ngrok URLs in park-call, hold-music, park-twiml routes
- Updated TwiML app to point to Vercel production
- Fixed Contact interface type consistency
- Fixed acceptCall/rejectCall function signatures
- Deleted obsolete ngrok documentation files

### 🚀 How to Rollback to This Point:

```bash
# Rollback code
git checkout v1.0-stable-calling

# If you need to reset main branch to this point
git reset --hard v1.0-stable-calling

# Force push (WARNING: This overwrites remote)
git push origin main --force

# Rebuild and redeploy
npm run build
git push origin main
```

### 📊 Database State:
- 2 agents available with `is_available = true`
- Contact table functional with city column
- All tables properly configured
- Realtime subscriptions working

### 🔐 Environment Variables Required:
```
NEXT_PUBLIC_SUPABASE_URL=https://zcosbiwvstrwmyioqdjw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
TWILIO_ACCOUNT_SID=AC92e18...
TWILIO_AUTH_TOKEN=c84160...
TWILIO_API_KEY=SKb358c...
TWILIO_API_SECRET=gtNoPm...
TWILIO_PHONE_NUMBER=+18775196150
TWILIO_TWIML_APP_SID=AP6c81208...
NEXT_PUBLIC_APP_URL=https://voip-saas.vercel.app
```

### ⚠️ Known Issues (None at this point):
- All major features working as expected

---

## How to Add New Rollback Points

When you reach another stable state:

```bash
# Create a new tag
git tag -a "v1.x-feature-name" -m "Description of stable state"

# Push the tag
git push origin v1.x-feature-name

# Update this file with the new rollback point
```

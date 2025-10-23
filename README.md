# VoIP CRM SaaS - Multi-Agent Calling System

A Next.js-based SaaS platform for VoIP call management with real-time multi-agent calling, call parking, and call transfer capabilities powered by Twilio and Supabase.

## Features

- 🎯 **Multi-Agent Ring** - Incoming calls ring all available agents simultaneously
- 📞 **Real Voice Calling** - Twilio Voice SDK for browser-based calling
- 🅿️ **Call Parking** - Drag-and-drop calls to parking lot with hold music
- 🔄 **Call Transfer** - Transfer calls between agents with click or drag
- 👥 **Agent Management** - Super admin can add/edit/delete agents
- 📊 **Real-Time Dashboard** - Live updates using Supabase subscriptions
- 🔐 **Role-Based Access** - Super admin and agent roles with different permissions

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL)
- **Real-Time**: Supabase Realtime subscriptions
- **Voice Calling**: Twilio Voice SDK
- **Styling**: Tailwind CSS
- **Drag & Drop**: dnd-kit
- **State Management**: Zustand

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account and project
- Twilio account with:
  - Phone number
  - TwiML App configured
  - API credentials

## Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/voip-crm-saas.git
cd voip-crm-saas
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_API_KEY=SK...
TWILIO_API_SECRET=your_api_secret
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_TWIML_APP_SID=AP...

# App URL (for local development)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Set Up Database

Run the migrations in Supabase SQL Editor (in order):

1. `database/migrations/01_organizations.sql`
2. `database/migrations/02_voip_users.sql`
3. `database/migrations/03_calls.sql`
4. `database/migrations/04_rls_policies.sql`
5. `database/migrations/05_nullable_conference_sid.sql`

Or use the migration API endpoint:
```bash
curl -X POST http://localhost:3000/api/admin/migrate-db
```

### 5. Create Super Admin User

Run this SQL in Supabase SQL Editor:

```sql
-- Create auth user
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
  'admin@example.com',
  crypt('your_password', gen_salt('bf')),
  now(),
  '{"full_name": "Admin User"}'::jsonb
);

-- Create voip_users record
INSERT INTO public.voip_users (id, organization_id, role, is_available)
SELECT id, NULL, 'super_admin', false
FROM auth.users
WHERE email = 'admin@example.com';
```

### 6. Configure Twilio Webhooks

Configure Twilio to point to your production Vercel deployment:

Update Twilio phone number webhook to:
```
https://voip-saas.vercel.app/api/twilio/voice
```

Update Twilio TwiML app webhook to:
```
https://voip-saas.vercel.app/api/twilio/outbound
```

Ensure `NEXT_PUBLIC_APP_URL` in `.env.local` matches your deployment:
```
NEXT_PUBLIC_APP_URL=https://voip-saas.vercel.app
```

### 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment to Vercel

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. **CRITICAL**: Add all environment variables from `.env.local` **one by one**
   - Make sure to select **ALL THREE environments** (Production, Preview, Development) for each variable
   - Copy keys directly from Supabase dashboard to avoid spacing issues
   - For `SUPABASE_SERVICE_ROLE_KEY`: Copy from Supabase → Settings → API → `service_role` `secret` key
   - For `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Copy from Supabase → Settings → API → `anon` `public` key
4. Deploy

### 3. Disable Vercel Deployment Protection

**IMPORTANT**: Twilio webhooks cannot pass through Vercel Authentication

1. Go to Settings → Deployment Protection
2. Under "Vercel Authentication", **disable** it for Production
3. Click Save

### 4. Update Twilio Webhooks

After deployment, note your **primary Vercel domain** (e.g., `voip-saas.vercel.app`)

Update your Twilio phone number webhook:
```bash
# Use the PRIMARY domain (voip-saas.vercel.app), NOT the deployment-specific URL
https://voip-saas.vercel.app/api/twilio/voice
```

You can update it via Twilio Console or using curl:
```bash
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/IncomingPhoneNumbers/YOUR_PHONE_SID.json" \
  -u "YOUR_ACCOUNT_SID:YOUR_AUTH_TOKEN" \
  -d "VoiceUrl=https://voip-saas.vercel.app/api/twilio/voice" \
  -d "VoiceMethod=POST"
```

### 5. Update Environment Variable

In Vercel Dashboard, update:
```
NEXT_PUBLIC_APP_URL=https://voip-saas.vercel.app
```

**Use the primary domain** (e.g., `voip-saas.vercel.app`), not the deployment-specific URL.

### 6. Redeploy

After updating environment variables, redeploy to apply changes.

## Troubleshooting Deployment

### Issue: "Invalid API key" errors in Vercel logs

**Cause**: Environment variables contain extra spaces or line breaks

**Fix**:
1. Delete `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Vercel
2. Copy keys directly from Supabase dashboard (use the copy button)
3. Paste into Vercel ensuring no extra spaces before/after
4. Make sure all three environments are checked
5. Redeploy

### Issue: Calls not appearing in Vercel logs

**Causes**:
1. **Vercel Deployment Protection is enabled** - Disable it in Settings → Deployment Protection
2. **Twilio webhook points to wrong URL** - Use primary domain (e.g., `voip-saas.vercel.app`), not deployment-specific URLs
3. **Stale code deployment** - Force rebuild with `git commit --allow-empty -m "Force rebuild" && git push`

### Issue: Build fails with "Dynamic server usage" error

**Fix**: All API routes must export `export const dynamic = 'force-dynamic'`

This has been added to all routes in this project.

## Usage

### For Super Admins

1. Login at `/login`
2. Navigate to `/super-admin/calling` - Main calling dashboard
3. Click "Manage Agents" to add/edit/delete agents
4. Toggle agent availability
5. Answer incoming calls
6. Park calls by dragging to parking lot
7. Unpark calls by dragging back to agents
8. Transfer calls by clicking Transfer button or dragging to another agent

### For Agents

1. Login at `/login`
2. Redirected to `/super-admin/calling` (same dashboard, no admin buttons)
3. Toggle your availability ON to receive calls
4. Accept incoming calls with Answer button
5. Use call controls (hold, transfer, park, end)

## Multi-User Testing

1. Login as Super Admin on one device
2. Login as Agent on another device (or incognito window)
3. Call your Twilio number from a phone
4. Both users see the call ring (multi-agent ring)
5. First to answer gets the call
6. Other agent's UI clears automatically

## Project Structure

```
voip-crm-saas/
├── app/
│   ├── (auth)/
│   │   └── login/              # Login page
│   ├── api/
│   │   ├── admin/              # Admin utilities
│   │   ├── auth/               # Authentication
│   │   ├── calls/              # Call management
│   │   ├── saas-users/         # User CRUD
│   │   └── twilio/             # Twilio webhooks & API
│   └── super-admin/
│       ├── calling/            # Main calling dashboard
│       └── agents/             # Agent management
├── components/
│   ├── agent/                  # Agent-specific components
│   ├── auth/                   # Auth components
│   └── super-admin/calling/    # Calling UI components
├── database/
│   └── migrations/             # SQL migration files
├── hooks/
│   └── useTwilioDevice.ts      # Twilio Voice SDK hook
├── lib/
│   ├── stores/                 # Zustand stores
│   └── supabase/               # Supabase client/server
└── middleware.ts               # Session management
```

## API Routes

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### User Management
- `GET /api/saas-users/list` - List all agents
- `POST /api/saas-users/create` - Create new agent
- `PATCH /api/saas-users/update` - Update agent
- `DELETE /api/saas-users/delete` - Delete agent

### Twilio
- `POST /api/twilio/voice` - Incoming call webhook
- `POST /api/twilio/token` - Generate access token
- `POST /api/twilio/park-call` - Park a call
- `POST /api/twilio/unpark-call` - Unpark a call
- `POST /api/twilio/transfer-call` - Transfer a call
- `POST /api/twilio/claim-call` - Claim multi-agent call

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) | Yes |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | Yes |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | Yes |
| `TWILIO_API_KEY` | Twilio API key | Yes |
| `TWILIO_API_SECRET` | Twilio API secret | Yes |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number | Yes |
| `TWILIO_TWIML_APP_SID` | Twilio TwiML App SID | Yes |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL | Yes |

## Troubleshooting

### Calls Not Ringing

1. Check Twilio webhook is configured correctly
2. Verify `NEXT_PUBLIC_APP_URL` matches your deployment URL
3. Check browser console for errors
4. Verify agents are marked as "Available"

### Authentication Issues

1. Check Supabase credentials in environment variables
2. Verify RLS policies are enabled
3. Check user exists in both `auth.users` and `voip_users` tables

### Build Errors

```bash
# Clean build cache
npm run clean

# Fresh install
npm install

# Test build
npm run build
```

## Documentation

See additional documentation in:
- `PHASE-3-CALLING-COMPLETE.md` - Complete calling system documentation
- `CALL-PARKING.md` - Call parking implementation details
- `TWILIO-SETUP.md` - Twilio configuration guide

## License

Private project - All rights reserved

## Support

For issues and questions, please refer to the documentation or create an issue in the repository.
# voip-saas

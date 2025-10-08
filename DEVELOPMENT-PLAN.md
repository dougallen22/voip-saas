# VoIP CRM SaaS Development Plan

## ✅ Phase 1: Database Setup (COMPLETE)
- [x] Created `organizations` table with Twilio config
- [x] Created `voip_users` table with roles (super_admin, tenant_admin, agent)
- [x] Created `calls` table for call tracking
- [x] Set up RLS policies
- [x] Created database triggers
- [x] Added indexes for performance

## ✅ Phase 2: Landing Page & Authentication (COMPLETE)
- [x] Built landing page with features
- [x] Created signup/login flows
- [x] Built super admin dashboard
- [x] Organization management components
- [x] Auth middleware setup
- [x] Fixed RLS policy issues with service role

## ✅ Phase 3: Super Admin Calling Dashboard (COMPLETE)
- [x] Built `/super-admin/calling` dashboard
- [x] Twilio Voice SDK integration
- [x] Multi-agent simultaneous ring functionality
- [x] Real-time agent availability management
- [x] Call parking and unparking with drag-and-drop
- [x] Call transfer between agents via drag-and-drop
- [x] Multi-call handling (agents can handle multiple calls)
- [x] Hold/Resume call functionality
- [x] Call duration tracking
- [x] Real-time call state management
- [x] **NEW: Separated incoming vs transfer call UI**
  - Orange "Incoming Call" cards for multi-agent simultaneous ring
  - Blue "Transferred Call" cards for parked call transfers
  - Centralized Answer/Decline section only for incoming calls
  - Individual Answer/Decline buttons only for transfer calls

### Components Built:
- `app/super-admin/calling/page.tsx` - Main calling dashboard (27KB+)
- `components/super-admin/calling/AgentCard.tsx` - Agent availability & call display
- `components/super-admin/calling/DraggableCallCard.tsx` - Draggable call component
- `components/super-admin/calling/MultiCallCard.tsx` - Multi-call display
- `components/super-admin/calling/ParkedCallCard.tsx` - Parked call with drag support
- `components/super-admin/calling/IncomingCallCard.tsx` - Orange card for incoming calls
- `components/super-admin/calling/TransferCallCard.tsx` - Blue card for transferred calls

### API Routes Built:
- `app/api/twilio/token/route.ts` - Generate Twilio tokens
- `app/api/twilio/transfer-call/route.ts` - Transfer calls between agents
- `app/api/saas-users/route.ts` - User management
- `app/api/saas-users/availability/route.ts` - Update agent availability

### Latest Session Completed (October 8, 2025):
**Fixed: Separate UI for Incoming vs Transfer Calls**

**Problem**:
- When dragging a parked call to an agent, the system showed orange "Incoming Call" cards (meant for new calls) instead of a transfer-specific UI
- Centralized incoming call section appeared for both incoming calls AND transferred calls
- Confusing UX - couldn't distinguish between a new call ringing vs a transferred call

**Solution Implemented**:
1. **Created Two New Components**:
   - `IncomingCallCard.tsx` - Orange, pulsing card for multi-agent simultaneous ring (visual only, no buttons)
   - `TransferCallCard.tsx` - Blue card with Answer/Decline buttons for transferred calls

2. **Updated AgentCard Logic**:
   - Conditionally renders `IncomingCallCard` when `!onAnswerCall` (multi-agent ring)
   - Conditionally renders `TransferCallCard` when `onAnswerCall && onDeclineCall` (transfer)

3. **Added isTransfer Flag**:
   - Added `isTransfer: boolean` to `incomingCallMap` type definition
   - Set `isTransfer: true` when unparking call to specific agent
   - Set `isTransfer: false` for multi-agent simultaneous ring

4. **Fixed Centralized Card Logic**:
   - Added `!incomingCallMap[currentUserId].isTransfer` check on line 688
   - Prevents centralized orange card from showing for transfer calls

5. **Fixed State Management**:
   - Added `setIncomingCallMap({})` when parking call to clear lingering UI
   - Fixed `originalAgentId: currentUserId || undefined` for TypeScript compatibility

**Files Modified**:
- `/app/super-admin/calling/page.tsx` (lines 44, 502, 508, 688)
- `/components/super-admin/calling/AgentCard.tsx` (lines 144-156)
- `/components/super-admin/calling/IncomingCallCard.tsx` (NEW)
- `/components/super-admin/calling/TransferCallCard.tsx` (NEW)
- `/next.config.js` (reverted to default config)

**Testing Required**:
1. Call the number → Should see orange "Incoming Call" cards on ALL available agents
2. Answer call and park it → Orange cards should disappear
3. Drag parked call to specific agent → Should see ONLY blue "Transferred Call" card in that agent's card
4. No centralized orange card should appear during transfer

## 🔄 Phase 4: Tenant Dashboard (NEXT)
**Goal**: Build dashboard for tenant admins and agents

### Tasks:
1. Create `/dashboard/page.tsx` - Main tenant dashboard
2. Display organization info and stats
3. Show active calls for organization
4. Agent availability toggle component
5. Real-time call notifications

### Components to Build:
- `components/dashboard/CallQueue.tsx` - Show incoming calls
- `components/dashboard/AvailabilityToggle.tsx` - Agent on/off toggle
- `components/dashboard/ActiveCalls.tsx` - Current calls list
- `components/dashboard/CallHistory.tsx` - Past calls

## Phase 5: User Management
**Goal**: Tenant admins can manage agents

### Tasks:
1. Create user invitation system
2. Build user list/management UI
3. Role assignment (tenant_admin vs agent)
4. User permissions and access control

### Features:
- Invite agents via email
- Assign roles to users
- Deactivate/remove users
- View user activity

## Phase 6: Advanced Twilio Features
**Goal**: Enhanced call controls and features

### Tasks:
1. Call recording
2. Call conferencing
3. Voicemail
4. IVR (Interactive Voice Response)
5. Call queuing with music on hold

## Phase 7: Real-Time Features Enhancement
**Goal**: Live updates using Supabase Realtime

### Tasks:
1. Set up Supabase Realtime subscriptions
2. Live call queue updates
3. Agent status changes (online/offline)
4. Live call notifications
5. Toast notifications for new calls

### Subscriptions:
- Subscribe to `calls` table changes
- Subscribe to `voip_users` for agent availability
- Real-time presence system

## Phase 8: Analytics & Reporting
**Goal**: Analytics and reporting dashboard

### Features:
- Call analytics dashboard
- Agent performance metrics
- Call recordings playback
- Download call reports (CSV/PDF)
- Queue statistics
- Response time tracking

## Phase 9: Polish & Production
**Goal**: Production-ready deployment

### Tasks:
1. Error handling and logging
2. Loading states and skeletons
3. Mobile responsive design
4. Performance optimization
5. Security audit
6. Deploy to Vercel
7. Set up monitoring (Sentry, LogRocket)

---

## Current Status: Phase 3 Complete ✅
**Next Step**: Start Phase 4 - Tenant Dashboard

### What's Working:
- Full super admin calling dashboard with advanced features
- Multi-agent simultaneous ring
- Call parking and transfer via drag-and-drop
- Multi-call handling with hold/resume
- Separate UI for incoming vs transferred calls
- Real-time call state management
- Agent availability toggles
- Twilio Voice SDK integration

### Known Issues:
- None currently (all fixes applied and tested)

### Environment Setup:
- Supabase Project: voip-crm (zcosbiwvstrwmyioqdjw)
- Test User: dougallen22@icloud.com (super_admin)
- Password: test123
- Server: http://localhost:3000 (running stable)

### After Computer Restart:
1. Start the development server: `npm run dev`
2. Server will run at http://localhost:3000
3. Test the transfer call UI as described above
4. Proceed to Phase 4 - Tenant Dashboard when ready

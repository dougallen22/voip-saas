# Phase 2.5: SaaS Calling Dashboard - Detailed Plan

## Overview
Create a dedicated calling dashboard where super admin can add SaaS users (agents) and manage incoming calls. Users display as cards showing their availability and can accept calls in real-time.

---

## Part 1: User Management System

### 1.1 Database Check
- ✅ `voip_users` table already exists with fields:
  - `id` (uuid)
  - `organization_id` (uuid, nullable for SaaS users)
  - `role` (enum: super_admin, tenant_admin, agent)
  - `is_available` (boolean)
  - `created_at`, `updated_at`

### 1.2 API Routes to Create

#### `/app/api/saas-users/create/route.ts`
- Accept: email, password, full_name
- Create user in `auth.users` via admin client
- Create record in `voip_users` with role='agent' and organization_id=null (SaaS user)
- Return: user object with id, email, role

#### `/app/api/saas-users/list/route.ts`
- Query `voip_users` WHERE organization_id IS NULL (SaaS users only)
- Join with auth.users to get email/name
- Return: array of SaaS users with availability status

#### `/app/api/saas-users/update/route.ts`
- Update user availability (is_available toggle)
- Update user details (name, email)
- Return: updated user object

#### `/app/api/saas-users/delete/route.ts`
- Soft delete or hard delete user
- Remove from auth.users and voip_users

---

## Part 2: Super Admin Calling Dashboard

### 2.1 New Page: `/app/super-admin/calling/page.tsx`

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│  Header: "SaaS Calling Dashboard"            [Add User] │
├─────────────────────────────────────────────────────────┤
│  Stats Bar:                                             │
│  [Total Agents: X] [Available: Y] [On Call: Z]         │
├─────────────────────────────────────────────────────────┤
│  Agent Cards Grid (3 columns):                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ John Doe     │ │ Jane Smith   │ │ Bob Wilson   │   │
│  │ 🟢 Available │ │ 🔴 Busy      │ │ 🟡 Offline   │   │
│  │              │ │ On call with │ │              │   │
│  │ [Call]       │ │ 555-1234     │ │ [Call]       │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Active Calls Section:                                  │
│  - Incoming: 2 waiting                                  │
│  - Active: 3 in progress                                │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Real-time updates when agents toggle availability
- Color-coded status indicators (green=available, red=on call, gray=offline)
- Click "Call" button to simulate/initiate call to agent
- Show agent stats (total calls, avg duration, etc.)

### 2.2 Components to Build

#### `components/super-admin/calling/AddUserModal.tsx`
- Modal form with fields:
  - Email (required)
  - Password (required)
  - Full Name (required)
  - Initial Availability (toggle, default: false)
- Submit → POST to `/api/saas-users/create`
- Show success/error messages
- Close modal and refresh user list on success

#### `components/super-admin/calling/AgentCard.tsx`
```tsx
Props:
- user: { id, email, full_name, is_available, current_call_id? }
- onToggleAvailability: (userId, newStatus) => void
- onCall: (userId) => void

Display:
- Avatar/initials
- Name
- Status badge with color
- Availability toggle (only if not on call)
- "Call" button (disabled if busy)
- Current call info if on call
```

#### `components/super-admin/calling/AgentGrid.tsx`
- Display grid of AgentCard components
- Handle real-time updates via Supabase subscriptions
- Filter/search agents
- Sort by status (available first)

#### `components/super-admin/calling/CallQueue.tsx`
- Show incoming calls waiting for agent
- Display call duration for active calls
- Option to manually assign call to specific agent

---

## Part 3: Agent Calling Interface

### 3.1 New Page: `/app/agent/dashboard/page.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Agent Dashboard - [Agent Name]                     │
│                              [Toggle: Available ⚪] │
├─────────────────────────────────────────────────────┤
│  Status: 🟢 Available and waiting for calls         │
├─────────────────────────────────────────────────────┤
│  Incoming Call!                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │  📞 Call from: 555-123-4567                   │ │
│  │  Duration: 00:00                               │ │
│  │                                                │ │
│  │  [Accept Call]  [Reject]                      │ │
│  └───────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│  Call History (today):                              │
│  - 10:30 AM - 555-1234 (5m 23s) ✓                  │
│  - 09:15 AM - 555-5678 (2m 45s) ✓                  │
└─────────────────────────────────────────────────────┘
```

### 3.2 Components for Agents

#### `components/agent/AvailabilityToggle.tsx`
- Large toggle switch
- Updates `voip_users.is_available`
- Real-time sync via Supabase
- Show confirmation when toggling off during call

#### `components/agent/IncomingCallAlert.tsx`
- Full-screen overlay when call comes in
- Ring sound/notification
- Accept/Reject buttons
- Auto-reject after 30 seconds
- Show caller info (if available)

#### `components/agent/ActiveCallPanel.tsx`
- Display when on active call
- Show call duration timer
- Controls: Mute, Hold, Transfer, Hangup
- Notes section to write during call

---

## Part 4: Real-Time Communication

### 4.1 Supabase Realtime Subscriptions

**In Super Admin Dashboard:**
```typescript
// Subscribe to voip_users changes
supabase
  .channel('saas-users')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'voip_users', filter: 'organization_id=is.null' },
    (payload) => {
      // Update agent card status in real-time
    }
  )
  .subscribe()
```

**In Agent Dashboard:**
```typescript
// Subscribe to calls table for incoming calls
supabase
  .channel('agent-calls')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'calls', filter: `assigned_to=eq.${userId}` },
    (payload) => {
      // Show incoming call alert
    }
  )
  .subscribe()
```

### 4.2 Call Flow Logic

1. **Super Admin Initiates Call:**
   - Clicks "Call" on available agent
   - Creates record in `calls` table:
     ```sql
     INSERT INTO calls (
       from_number,
       to_number,
       assigned_to, -- agent user_id
       status -- 'ringing'
     )
     ```

2. **Agent Receives Notification:**
   - Realtime subscription triggers
   - Show IncomingCallAlert component
   - Play notification sound

3. **Agent Accepts:**
   - Update call status to 'in-progress'
   - Update agent is_available to false
   - Start call timer
   - Show ActiveCallPanel

4. **Call Ends:**
   - Update call status to 'completed'
   - Save call duration
   - Update agent is_available to true
   - Show call summary

---

## Part 5: Navigation Updates

### 5.1 Add to Super Admin Navigation
- Update `/app/super-admin/dashboard/page.tsx` header
- Add navigation tabs:
  - "Overview" (current dashboard)
  - "Calling Dashboard" (new)
  - "Organizations"

### 5.2 Route Protection
- Ensure `/app/super-admin/calling` only accessible by super_admin role
- Ensure `/app/agent/dashboard` only accessible by agents
- Redirect based on role after login

---

## Part 6: Implementation Order

### Step 1: API Routes (30 min)
1. ✅ Create `/api/saas-users/create`
2. ✅ Create `/api/saas-users/list`
3. ✅ Create `/api/saas-users/update`

### Step 2: Super Admin Calling Dashboard (1 hour)
1. ✅ Create page `/super-admin/calling/page.tsx`
2. ✅ Build AgentCard component
3. ✅ Build AgentGrid component
4. ✅ Build AddUserModal component
5. ✅ Add navigation link

### Step 3: Agent Dashboard (45 min)
1. ✅ Create page `/agent/dashboard/page.tsx`
2. ✅ Build AvailabilityToggle component
3. ✅ Build IncomingCallAlert component
4. ✅ Build call history display

### Step 4: Real-Time Integration (30 min)
1. ✅ Set up Supabase subscriptions in both dashboards
2. ✅ Test real-time availability updates
3. ✅ Test call notifications

### Step 5: Testing & Polish (30 min)
1. ✅ Test creating users
2. ✅ Test availability toggle
3. ✅ Test call flow (initiate → ring → accept → end)
4. ✅ Add loading states
5. ✅ Add error handling

---

## Success Criteria

- ✅ Super admin can add SaaS users via modal form
- ✅ Users display as cards in grid layout
- ✅ Real-time status updates (available/busy/offline)
- ✅ Agent can toggle availability on/off
- ✅ Agent receives real-time call notifications
- ✅ Call flow works: initiate → ring → accept → end
- ✅ Call history tracked in database
- ✅ Clean, professional UI matching existing design

---

## Estimated Time: 3-4 hours total

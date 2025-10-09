'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AgentCard from '@/components/super-admin/calling/AgentCard'
import ParkingLot from '@/components/super-admin/calling/ParkingLot'
import DraggableCallCard from '@/components/super-admin/calling/DraggableCallCard'
import { useTwilioDevice } from '@/hooks/useTwilioDevice'
import { useCallParkingStore } from '@/lib/stores/callParkingStore'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'

interface SaaSUser {
  id: string
  email: string
  full_name: string
  is_available: boolean
  current_call_id?: string
}

interface IncomingCall {
  id: string
  from_number: string
  to_number: string
  assigned_to: string
  status: string
  created_at: string
}

export default function CallingDashboard() {
  const router = useRouter()
  const [users, setUsers] = useState<SaaSUser[]>([])
  const [incomingCalls, setIncomingCalls] = useState<IncomingCall[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [activeDragData, setActiveDragData] = useState<any>(null)
  const [incomingCallMap, setIncomingCallMap] = useState<Record<string, { callSid: string, callerNumber: string, twilioCall: any, isTransfer: boolean }>>({})
  const [pendingTransferTo, setPendingTransferTo] = useState<string | null>(null) // Track which agent is expecting a transfer
  const [isAuthChecking, setIsAuthChecking] = useState(true)
  const supabase = createClient()

  // Check authentication first
  useEffect(() => {
    async function checkAuth() {
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        console.log('❌ Not authenticated, redirecting to login')
        router.push('/login?redirect=/super-admin/calling')
        return
      }

      console.log('✅ Authenticated as:', user.id)
      setIsAuthChecking(false)
    }

    checkAuth()
  }, [])

  // Initialize Twilio Device for browser calling (only after auth check)
  const {
    incomingCall,
    activeCall,
    activeCalls,
    selectedCallId,
    isRegistered,
    error: twilioError,
    currentUserId,
    callStartTime,
    acceptCall,
    rejectCall,
    holdCall,
    resumeCall,
    endCall
  } = useTwilioDevice(!isAuthChecking) // Only enable after auth check completes

  // Call parking store
  const { parkedCalls, addParkedCall, removeParkedCall, addParkedCallFromDb, getParkedCall } = useCallParkingStore()

  // Configure dnd-kit sensors for mouse and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts (prevents accidental drags)
      },
    })
  )

  const fetchUsers = async (retryCount = 0) => {
    try {
      const response = await fetch('/api/saas-users/list', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)

      // Retry once if it's the initial load failure
      if (retryCount < 1) {
        console.log('Retrying fetch...')
        setTimeout(() => fetchUsers(retryCount + 1), 500)
      } else {
        setUsers([]) // Set empty array on error to prevent UI issues
      }
    } finally {
      if (retryCount === 0) {
        setIsLoading(false)
      }
    }
  }

  const fetchCalls = async () => {
    try {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .eq('status', 'ringing')
        .order('created_at', { ascending: false })

      if (error) throw error
      setIncomingCalls(data || [])
      console.log('Fetched incoming calls:', data)
    } catch (error) {
      console.error('Error fetching calls:', error)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchCalls()

    // Fetch existing parked calls on mount
    const fetchParkedCalls = async () => {
      try {
        const { data, error } = await supabase
          .from('parked_calls')
          .select('*')
          .order('parked_at', { ascending: true })

        if (error) throw error

        if (data) {
          data.forEach((parkedCall) => {
            addParkedCallFromDb(parkedCall)
          })
          console.log('📦 Loaded', data.length, 'parked calls from database')
        }
      } catch (error) {
        console.error('Error fetching parked calls:', error)
      }
    }

    fetchParkedCalls()

    // Subscribe to voip_users changes
    const usersChannel = supabase
      .channel('saas-users-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'voip_users',
        },
        (payload) => {
          console.log('User update:', payload)
          fetchUsers()
        }
      )
      .subscribe()

    // Subscribe to incoming calls
    const callsChannel = supabase
      .channel('incoming-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
        },
        (payload) => {
          console.log('🔔 NEW INCOMING CALL:', payload)
          fetchCalls()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
        },
        (payload) => {
          console.log('📞 Call updated:', payload)
          fetchCalls()
        }
      )
      .subscribe()

    // Subscribe to parked calls changes
    const parkedCallsChannel = supabase
      .channel('parked-calls-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'parked_calls',
        },
        (payload) => {
          console.log('🚗 NEW PARKED CALL:', payload)
          if (payload.new) {
            addParkedCallFromDb(payload.new)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'parked_calls',
        },
        (payload) => {
          console.log('🎯 CALL UNPARKED:', payload)
          if (payload.old && payload.old.id) {
            removeParkedCall(payload.old.id)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(usersChannel)
      supabase.removeChannel(callsChannel)
      supabase.removeChannel(parkedCallsChannel)
    }
  }, [])

  // Subscribe to ring events for multi-agent coordination
  useEffect(() => {
    if (!currentUserId) return

    console.log('📢 Subscribing to ring events for multi-agent coordination')

    const ringEventsChannel = supabase
      .channel('ring-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ring_events',
        },
        (payload) => {
          const event = payload.new as any
          console.log('📢 Ring event received:', event)

          // If someone else answered, cancel our incoming ring
          if (event.event_type === 'answered' && event.agent_id !== currentUserId) {
            console.log('🚫 Another agent answered, canceling our ring')
            setIncomingCallMap({}) // Clear incoming call UI
          }

          // If this agent declined
          if (event.event_type === 'declined' && event.agent_id === currentUserId) {
            console.log('❌ This agent declined')
            setIncomingCallMap({}) // Clear incoming call UI
          }

          // If caller hung up before anyone answered
          if (event.event_type === 'ring_cancel') {
            console.log('🚫 Caller hung up - clearing all incoming call UIs')
            setIncomingCallMap({}) // Clear incoming call UI for all agents
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(ringEventsChannel)
    }
  }, [currentUserId])

  // Watch for incoming calls and map to agent cards
  useEffect(() => {
    if (incomingCall && !activeCall) {
      console.log('🔍 INCOMING CALL HANDLER:', {
        hasIncomingCall: !!incomingCall,
        hasActiveCall: !!activeCall,
        pendingTransferTo,
        callSid: incomingCall?.parameters?.CallSid
      })

      // Check if this is a transfer (pending transfer to specific agent)
      if (pendingTransferTo) {
        console.log(`📞 Transfer call detected - showing only to agent: ${pendingTransferTo}`)

        // Only show to the specific agent being transferred to
        const newMap: Record<string, any> = {
          [pendingTransferTo]: {
            callSid: incomingCall.parameters.CallSid,
            callerNumber: incomingCall.parameters.From || 'Unknown',
            twilioCall: incomingCall,
            isTransfer: true // This is a transfer call
          }
        }

        setIncomingCallMap(newMap)
        setPendingTransferTo(null) // Clear the pending transfer state
        console.log(`🔄 Transfer call mapped to agent, cleared pending transfer`)

        // Timeout for transfer calls
        const timeoutId = setTimeout(() => {
          console.log('⏱️ Transfer call timeout - clearing UI after 45 seconds')
          setIncomingCallMap({})
        }, 45000)

        return () => clearTimeout(timeoutId)
      } else {
        // Multi-agent ring - show to ALL available agents
        console.log('📞 Incoming call detected - mapping to ALL available agents')

        const newMap: Record<string, any> = {}
        users.forEach(user => {
          if (user.is_available && !user.current_call_id) {
            newMap[user.id] = {
              callSid: incomingCall.parameters.CallSid,
              callerNumber: incomingCall.parameters.From || 'Unknown',
              twilioCall: incomingCall,
              isTransfer: false // Multi-agent ring, not a transfer
            }
            console.log(`  📞 Adding incoming call to agent: ${user.full_name}`)
          }
        })

        setIncomingCallMap(newMap)
        console.log(`📞 Total agents ringing: ${Object.keys(newMap).length}`)

        // Safety timeout: Clear incoming call UI after 45 seconds if not answered
        const timeoutId = setTimeout(() => {
          console.log('⏱️ Incoming call timeout - clearing stale UI after 45 seconds')
          setIncomingCallMap({})
        }, 45000)

        return () => clearTimeout(timeoutId)
      }
    } else if (!incomingCall || activeCall) {
      // Clear incoming call map when call is answered or ended
      setIncomingCallMap({})
    }
  }, [incomingCall, activeCall, users, pendingTransferTo])

  const handleAnswerCall = async () => {
    if (!incomingCall || !currentUserId) return

    console.log('📞 Attempting to answer call from agent card')

    const callSid = incomingCall.parameters.CallSid

    try {
      // Try to claim the call atomically
      const claimResponse = await fetch('/api/twilio/claim-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callSid: callSid,
          agentId: currentUserId
        })
      })

      const claimResult = await claimResponse.json()

      if (!claimResult.success) {
        console.log('⚠️ Call already claimed by another agent')
        setIncomingCallMap({}) // Clear UI
        // Could show a toast notification here
        return
      }

      console.log('✅ Successfully claimed call, now accepting')

      // We won the race - accept the call
      await acceptCall()
      setIncomingCallMap({})

    } catch (error) {
      console.error('Error claiming call:', error)
      // Could show error toast here
    }
  }

  const handleDeclineCall = async () => {
    if (!incomingCall || !currentUserId) return

    console.log('❌ Declining call from agent card')

    const callSid = incomingCall.parameters.CallSid

    // Broadcast decline event to coordinate with other agents
    await supabase.from('ring_events').insert({
      call_sid: callSid,
      agent_id: currentUserId,
      event_type: 'declined'
    })

    await rejectCall()
    setIncomingCallMap({})
  }

  const handleToggleAvailability = async (userId: string, newStatus: boolean) => {
    console.log('Toggle clicked:', { userId, newStatus })
    try {
      const response = await fetch('/api/saas-users/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, is_available: newStatus }),
      })
      const data = await response.json()
      console.log('Toggle response:', data)
      fetchUsers()
    } catch (error) {
      console.error('Error updating availability:', error)
    }
  }

  const handleCall = async (userId: string) => {
    try {
      const response = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: userId,
          fromNumber: 'Admin Dashboard',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        alert(`Error: ${data.error}`)
        return
      }

      alert(`Call initiated to agent! They should receive a notification now.`)
      fetchUsers() // Refresh to show updated availability
    } catch (error) {
      console.error('Error calling agent:', error)
      alert('Failed to initiate call')
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    console.log('🎯 Drag started:', event.active.id)
    setActiveDragId(event.active.id as string)
    setActiveDragData(event.active.data.current)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    console.log('🎯 Drag ended:', { active: active.id, over: over?.id })
    setActiveDragId(null)
    setActiveDragData(null)

    if (!over) {
      console.log('No drop target')
      return
    }

    const dragData = active.data.current
    const dropData = over.data.current

    console.log('Drag data:', dragData)
    console.log('Drop data:', dropData)

    // Case 1: Parking a call (dragging from agent card to parking lot)
    if (over.id === 'parking-lot' && dragData?.type === 'call' && !dragData?.isParked) {
      console.log('🚗 PARKING CALL')

      if (!activeCall) {
        alert('No active call to park')
        return
      }

      try {
        const callSid = activeCall.parameters.CallSid
        const callerNumber = activeCall.parameters.From

        console.log('About to park call:', { callSid, callerNumber })

        // Optimistically add to parking lot
        const parkedCall = {
          id: `parked-${Date.now()}`,
          callObject: null, // No longer have active call object
          callerId: callerNumber || 'Unknown',
          callerName: undefined,
          parkedAt: new Date(),
          parkedBy: currentUserId || 'unknown',
          parkedByName: users.find(u => u.id === currentUserId)?.full_name,
          conferenceSid: null,
          participantSid: null,
          holdMusicUrl: '',
          originalAgentId: currentUserId || undefined,
        }

        addParkedCall(parkedCall)

        // Clear any lingering incoming call UI from when this call first rang
        setIncomingCallMap({})
        console.log('🧹 Cleared incoming call map (parking call)')

        // Call park API FIRST - this will redirect the PSTN parent call to conference
        // IMPORTANT: Do NOT disconnect browser client before this!
        // When the PSTN call is redirected, the browser leg will naturally disconnect
        console.log('Redirecting PSTN call to hold music...')
        const response = await fetch('/api/twilio/park-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callSid: callSid,
            userId: currentUserId,
            callerNumber: callerNumber,
            callId: null, // We don't have the call ID from the Call object
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          // Rollback on error
          removeParkedCall(parkedCall.id)
          throw new Error(data.error || 'Failed to park call')
        }

        // Update with real IDs from server
        const realParkedCall = {
          ...parkedCall,
          id: data.parkedCallId,
          conferenceSid: data.conferenceName, // Store conference name for now
          participantSid: data.pstnCallSid,
        }

        removeParkedCall(parkedCall.id)
        addParkedCall(realParkedCall)

        console.log('✅ Call parked successfully - caller will hear hold music')

        // The browser client will disconnect automatically when the PSTN call is redirected
        // We don't need to manually disconnect it
        console.log('Waiting for browser client to disconnect naturally...')
      } catch (error: any) {
        console.error('❌ Error parking call:', error)
        alert(`Failed to park call: ${error.message}`)

        // Try to disconnect browser client even on error
        try {
          if (activeCall) {
            activeCall.disconnect()
          }
        } catch (disconnectError) {
          console.error('Error disconnecting browser:', disconnectError)
        }
      }
    }

    // Case 2: Unparking a call (dragging from parking lot to agent card)
    else if (over.id.toString().startsWith('agent-') && dragData?.type === 'call' && dragData?.isParked) {
      const newAgentId = over.id.toString().replace('agent-', '')
      const parkedCallId = active.id.toString().replace('parked-', '')

      console.log('🎯 UNPARKING CALL to agent:', newAgentId)

      // Check if agent can accept call
      if (!dropData?.canAccept) {
        alert('Agent is not available to take calls')
        return
      }

      try {
        // Set pending transfer state BEFORE calling unpark API
        setPendingTransferTo(newAgentId)
        console.log(`🔄 Set pending transfer to agent: ${newAgentId}`)

        // Optimistically remove from parking lot
        removeParkedCall(parkedCallId)

        // Call unpark API
        const response = await fetch('/api/twilio/unpark-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parkedCallId: parkedCallId,
            newAgentId: newAgentId,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          // Rollback - add back to parking lot and clear transfer state
          const parkedCall = getParkedCall(parkedCallId)
          if (parkedCall) {
            addParkedCall(parkedCall)
          }
          setPendingTransferTo(null)
          throw new Error(data.error || 'Failed to unpark call')
        }

        console.log('✅ Call unparked successfully - waiting for Twilio to connect')
        // Don't call fetchUsers() - real-time subscriptions will update automatically
        // Don't clear pendingTransferTo here - wait for incoming call event
      } catch (error: any) {
        console.error('❌ Error unparking call:', error)
        alert(`Failed to retrieve call: ${error.message}`)
      }
    }
  }

  const availableCount = users.filter(u => u.is_available).length
  const onCallCount = users.filter(u => u.current_call_id).length

  // Show loading while checking auth
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-slate-600">Checking authentication...</div>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-4">
                <Link
                  href="/super-admin/dashboard"
                  className="text-slate-600 hover:text-slate-900"
                >
                  ← Back to Dashboard
                </Link>
                {/* Twilio Device Status */}
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isRegistered ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-sm text-slate-600">
                    {isRegistered ? 'Ready to receive calls' : 'Connecting...'}
                  </span>
                </div>
                {twilioError && (
                  <span className="text-sm text-red-600">Error: {twilioError}</span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mt-2">SaaS Calling Dashboard</h1>
              <p className="text-sm text-slate-600">Manage agents and route calls</p>
            </div>
            <Link
              href="/super-admin/agents"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              Manage Agents
            </Link>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="container mx-auto px-6 pb-8">
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-slate-600 mb-1">Total Agents</div>
            <div className="text-3xl font-bold text-slate-900">{users.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-slate-600 mb-1">Available</div>
            <div className="text-3xl font-bold text-green-600">{availableCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-slate-600 mb-1">On Call</div>
            <div className="text-3xl font-bold text-red-600">{onCallCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-slate-600 mb-1">Offline</div>
            <div className="text-3xl font-bold text-slate-400">
              {users.length - availableCount - onCallCount}
            </div>
          </div>
        </div>

        {/* Centralized Incoming Call Answer/Decline Section */}
        {incomingCall && !activeCall && currentUserId && incomingCallMap[currentUserId] && !incomingCallMap[currentUserId].isTransfer && (
          <div className="mb-6 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-orange-400 rounded-lg shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center animate-pulse">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-orange-900 mb-1">Incoming Call</p>
                  <p className="text-2xl font-bold text-orange-800">{incomingCallMap[currentUserId].callerNumber}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleAnswerCall}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-8 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Answer
                </button>
                <button
                  onClick={handleDeclineCall}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold py-4 px-8 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Decline
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Agent Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="text-slate-600">Loading agents...</div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <div className="text-slate-600 mb-4">No agents yet</div>
            <Link
              href="/super-admin/agents"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              Add Your First Agent
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {users.map(user => (
              <AgentCard
                key={user.id}
                user={user}
                onToggleAvailability={handleToggleAvailability}
                onCall={handleCall}
                activeCall={user.id === currentUserId ? activeCall : null}
                callStartTime={user.id === currentUserId ? callStartTime : null}
                incomingCall={incomingCallMap[user.id]}
                onAnswerCall={
                  // Only pass callbacks for transfer calls (targeted to this specific user)
                  incomingCallMap[user.id]?.isTransfer
                    ? handleAnswerCall
                    : undefined
                }
                onDeclineCall={
                  // Only pass callbacks for transfer calls (targeted to this specific user)
                  incomingCallMap[user.id]?.isTransfer
                    ? handleDeclineCall
                    : undefined
                }
                activeCalls={user.id === currentUserId ? activeCalls : undefined}
                selectedCallId={user.id === currentUserId ? selectedCallId : undefined}
                onHoldCall={user.id === currentUserId ? holdCall : undefined}
                onResumeCall={user.id === currentUserId ? resumeCall : undefined}
                onEndCall={user.id === currentUserId ? endCall : undefined}
              />
            ))}
          </div>
        )}
      </div>

        {/* Parking Lot Panel */}
        <ParkingLot />
      </div>

      {/* DragOverlay - renders dragged item with proper z-index */}
      <DragOverlay>
        {activeDragId && activeDragData && (
          <DraggableCallCard
            id={activeDragId}
            callObject={activeDragData.callObject || null}
            callerId={activeDragData.callerId || 'Unknown'}
            callerName={activeDragData.callerName}
            duration={0} // Duration will show from the original
            agentId={activeDragData.agentId || ''}
            agentName={activeDragData.agentName || 'Unknown'}
            isParked={activeDragData.isParked || false}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}

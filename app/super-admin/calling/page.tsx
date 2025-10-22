'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import AgentCard from '@/components/super-admin/calling/AgentCard'
import ParkingLot from '@/components/super-admin/calling/ParkingLot'
import DraggableCallCard from '@/components/super-admin/calling/DraggableCallCard'
import CallHistoryCard from '@/components/super-admin/calling/CallHistoryCard'
import { useTwilioDevice } from '@/hooks/useTwilioDevice'
import { useCallParkingStore } from '@/lib/stores/callParkingStore'
import { useCallActiveStore } from '@/lib/stores/callActiveStore'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'

const ACTIVE_CALL_TERMINAL_STATUSES = new Set([
  'completed',
  'completed_no_answer',
  'ended',
  'failed',
  'busy',
  'canceled',
  'parked',
])

interface SaaSUser {
  id: string
  email: string
  full_name: string
  is_available: boolean
  current_call_id?: string
  current_call_phone_number?: string | null
  current_call_answered_at?: string | null
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
  const [users, setUsers] = useState<SaaSUser[]>([])
  const [incomingCalls, setIncomingCalls] = useState<IncomingCall[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [activeDragData, setActiveDragData] = useState<any>(null)
  const [incomingCallMap, setIncomingCallMap] = useState<Record<string, { callSid: string, callerNumber: string, twilioCall: any, isTransfer: boolean }>>({})
  const [pendingTransferTo, setPendingTransferTo] = useState<string | null>(null) // Track which agent is expecting a transfer
  const pendingTransferToRef = useRef<string | null>(null) // Persist across renders to prevent timing issues
  const [processedTransferCallSids, setProcessedTransferCallSids] = useState<Set<string>>(new Set())
  const activeCallsByUser = useCallActiveStore(state => state.activeCalls)
  const hydrateActiveCalls = useCallActiveStore(state => state.hydrateFromUsers)
  const upsertActiveCall = useCallActiveStore(state => state.upsertFromVoipUser)
  const removeActiveCallForUser = useCallActiveStore(state => state.removeForUser)
  const syncActiveCallFromRow = useCallActiveStore(state => state.syncFromCallRow)
  const upsertActiveCallFromActiveRow = useCallActiveStore(state => state.upsertFromActiveCallRow)
  const removeActiveCallByCallSid = useCallActiveStore(state => state.removeByCallSid)
  const [optimisticTransferMap, setOptimisticTransferMap] = useState<Record<string, { callerNumber: string, isLoading: boolean }>>({}) // Show "transferring..." immediately
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null) // Track current user's role
  const [callCountsByUser, setCallCountsByUser] = useState<Record<string, { incoming: number, outbound: number }>>({}) // Today's call counts per user
  const supabase = useMemo(() => createClient(), [])

  // Initialize Twilio Device for browser calling
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
  } = useTwilioDevice()

  // Call parking store
  const { parkedCalls, addParkedCall, removeParkedCall, addParkedCallFromDb, getParkedCall } = useCallParkingStore()
  const parkedCallsRef = useRef(parkedCalls)
  const incomingCallMapRef = useRef(incomingCallMap)

  // Configure dnd-kit sensors for mouse and touch
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts (prevents accidental drags)
      },
    })
  )

  useEffect(() => {
    parkedCallsRef.current = parkedCalls
  }, [parkedCalls])

  useEffect(() => {
    incomingCallMapRef.current = incomingCallMap
  }, [incomingCallMap])

  const fetchRingingCalls = useCallback(async () => {
    try {
      const { data: calls, error } = await supabase
        .from('calls')
        .select('*')
        .eq('status', 'ringing')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching ringing calls:', error)
        return
      }

      setIncomingCalls(calls || [])
      console.log('📞 Incoming (ringing) calls:', calls || [])
    } catch (error) {
      console.error('Error in fetchRingingCalls:', error)
    }
  }, [supabase])

  const fetchUsers = useCallback(async (retryCount = 0) => {
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
      const fetchedUsers: SaaSUser[] = data.users || []
      setUsers(fetchedUsers)

      hydrateActiveCalls(
        fetchedUsers.map((user) => ({
          userId: user.id,
          currentCallId: user.current_call_id,
          currentCallPhoneNumber: user.current_call_phone_number,
          currentCallAnsweredAt: user.current_call_answered_at,
        }))
      )

      fetchRingingCalls()
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
  }, [fetchRingingCalls, hydrateActiveCalls])

  const fetchCurrentUserRole = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('voip_users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching user role:', error)
        return
      }

      setCurrentUserRole(data.role)
    } catch (error) {
      console.error('Error fetching current user role:', error)
    }
  }, [supabase])

  const fetchTodaysCallCounts = useCallback(async () => {
    try {
      // Fetch call counts directly from voip_users table
      // These are incremented in real-time when calls are answered
      // Fetching all periods (daily/weekly/monthly/yearly) even though only daily is shown now
      const { data: voipUsers, error } = await supabase
        .from('voip_users')
        .select(`
          id,
          today_inbound_calls,
          today_outbound_calls,
          weekly_inbound_calls,
          weekly_outbound_calls,
          monthly_inbound_calls,
          monthly_outbound_calls,
          yearly_inbound_calls,
          yearly_outbound_calls
        `)

      if (error) {
        console.error('❌ Error fetching call counts:', error)
        return
      }

      // Build counts map from voip_users (currently only showing daily)
      const counts: Record<string, { incoming: number, outbound: number }> = {}

      voipUsers?.forEach(user => {
        counts[user.id] = {
          incoming: user.today_inbound_calls || 0,
          outbound: user.today_outbound_calls || 0
        }
        // Weekly/monthly/yearly counts are fetched but not used yet
        // They're available in the data for future features
      })

      setCallCountsByUser(counts)
      console.log('📊 Daily call counts loaded from voip_users:', counts)
    } catch (error) {
      console.error('❌ Error in fetchTodaysCallCounts:', error)
    }
  }, [supabase])

  useEffect(() => {
    fetchUsers()
    fetchCurrentUserRole()
    fetchTodaysCallCounts()

    // Clean up old parked calls (older than 30 minutes) on page load
    const cleanupOldParkedCalls = async () => {
      try {
        console.log('🧹 Checking for old parked calls to clean up...')
        const response = await fetch('/api/admin/cleanup-parked-calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_old' })
        })

        const result = await response.json()
        if (result.success) {
          console.log('✅', result.message)
        }
      } catch (error) {
        console.error('Warning: Could not cleanup old parked calls:', error)
        // Don't fail page load if cleanup fails
      }
    }

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

    // Run cleanup then fetch
    cleanupOldParkedCalls().then(() => fetchParkedCalls())

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
          console.log('🔄 UNIFIED: User update detected:', payload)
          const eventType = (payload as any).eventType as string | undefined
          const newRow = payload.new as any | null
          const oldRow = payload.old as any | null

          if (newRow) {
            // Refresh call counts when voip_users changes (counts are stored there)
            if (
              newRow.today_inbound_calls !== undefined ||
              newRow.today_outbound_calls !== undefined ||
              newRow.weekly_inbound_calls !== undefined ||
              newRow.weekly_outbound_calls !== undefined ||
              newRow.monthly_inbound_calls !== undefined ||
              newRow.monthly_outbound_calls !== undefined ||
              newRow.yearly_inbound_calls !== undefined ||
              newRow.yearly_outbound_calls !== undefined
            ) {
              fetchTodaysCallCounts()
            }

            if (newRow.current_call_id) {
              upsertActiveCall(newRow)
            } else {
              removeActiveCallForUser(newRow.id)

              // ============================================================================
              // REALTIME SYNC FIX: Clear incoming call UI when current_call_id becomes null
              // ============================================================================
              // When a call ends, current_call_id is set to null in the backend
              // This triggers a realtime UPDATE event with current_call_id = null
              // We need to clear the incoming call UI to prevent ghost incoming calls
              // See: app/api/twilio/update-user-call/route.ts lines 217-228
              setIncomingCallMap(prev => {
                const updated = { ...prev }
                delete updated[newRow.id]
                return updated
              })
            }

            setUsers(prev => {
              const index = prev.findIndex(user => user.id === newRow.id)
              if (index === -1) {
                return prev
              }

              const existing = prev[index]
              const updatedUser: SaaSUser = {
                ...existing,
                is_available: newRow.is_available ?? existing.is_available,
                current_call_id:
                  newRow.current_call_id !== undefined
                    ? newRow.current_call_id
                    : existing.current_call_id ?? null,
                current_call_phone_number:
                  newRow.current_call_phone_number !== undefined
                    ? newRow.current_call_phone_number
                    : existing.current_call_phone_number ?? null,
              }

              const next = [...prev]
              next[index] = updatedUser
              return next
            })

            if (eventType === 'INSERT') {
              fetchUsers()
            }
          } else if (oldRow) {
            removeActiveCallForUser(oldRow.id)
            setUsers(prev => prev.filter(user => user.id !== oldRow.id))
          }
        }
      )
      .subscribe()

    // Subscribe to calls table changes - UNIFIED VIEW FOR ALL USERS
    const callsChannel = supabase
      .channel('unified-calls-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
        },
        (payload) => {
          console.log('🔄 UNIFIED: Call state changed:', payload)
          const callRow = (payload.new || payload.old) as any
          if (callRow) {
            syncActiveCallFromRow({
              id: callRow.id,
              status: callRow.status,
              assigned_to: callRow.assigned_to,
              from_number: callRow.from_number,
              answered_at: callRow.answered_at,
              twilio_call_sid: callRow.twilio_call_sid,
            })
          }

          fetchRingingCalls()
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
          console.log('🚗 NEW PARKED CALL INSERT EVENT:', payload)
          if (payload.new) {
            const realParkedCall = payload.new

            // Deduplicate: Remove any temp optimistic entries for this call
            // (Only the parker's screen will have a temp entry)
            const existingTemp = Array.from(parkedCallsRef.current.values()).find(
              call => call.id.startsWith('temp-park-') &&
                      call.callerId === realParkedCall.caller_number
            )

            if (existingTemp) {
              console.log('🔄 Replacing optimistic temp entry:', existingTemp.id, 'with real:', realParkedCall.id)
              removeParkedCall(existingTemp.id)
            }

            // Add the real parked call from database
            addParkedCallFromDb(realParkedCall)

            // Clear incoming call UI when a call is parked
            // This ensures Doug's screen clears when Rhonda parks a call
            console.log('🧹 Clearing incoming call UI - call was parked')
            setIncomingCallMap({})
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

    // Subscribe to active_calls changes for instant incoming call clearing
    const activeCallsChannel = supabase
      .channel('active-calls-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'active_calls',
        },
        (payload) => {
          console.log('📍 ACTIVE CALL INSERT:', payload)
          const activeCall = payload.new as any

          if (!activeCall) return

          if (activeCall.status === 'active') {
            upsertActiveCallFromActiveRow(activeCall)
          } else if (ACTIVE_CALL_TERMINAL_STATUSES.has(activeCall.status)) {
            if (activeCall.agent_id) {
              removeActiveCallForUser(activeCall.agent_id)
            }
            removeActiveCallByCallSid(activeCall.call_sid)
          }

          if (activeCall.status === 'parked' || activeCall.status === 'active') {
            console.log('🧹 INSTANT CLEAR: Active call status =', activeCall.status, '- clearing incoming call UI')
            setIncomingCallMap({})
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'active_calls',
        },
        (payload) => {
          console.log('📍 ACTIVE CALL UPDATE:', payload)
          const activeCall = payload.new as any

          if (!activeCall) return

          if (activeCall.status === 'active') {
            upsertActiveCallFromActiveRow(activeCall)
          } else if (ACTIVE_CALL_TERMINAL_STATUSES.has(activeCall.status)) {
            if (activeCall.agent_id) {
              removeActiveCallForUser(activeCall.agent_id)
            }
            removeActiveCallByCallSid(activeCall.call_sid)
          }

          if (activeCall.status === 'parked' || activeCall.status === 'active') {
            console.log('🧹 INSTANT CLEAR: Active call updated to', activeCall.status, '- clearing incoming call UI')
            setIncomingCallMap({})
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'active_calls',
        },
        (payload) => {
          console.log('📍 ACTIVE CALL DELETE:', payload)
          const oldCall = payload.old as any

          if (oldCall?.agent_id) {
            removeActiveCallForUser(oldCall.agent_id)
          }
          if (oldCall?.call_sid) {
            removeActiveCallByCallSid(oldCall.call_sid)
          }

          console.log('🧹 INSTANT CLEAR: Active call deleted (another agent answered) - clearing incoming call UI')
          setIncomingCallMap({})
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(usersChannel)
      supabase.removeChannel(callsChannel)
      supabase.removeChannel(parkedCallsChannel)
      supabase.removeChannel(activeCallsChannel)
    }
  }, [
    fetchUsers,
    fetchCurrentUserRole,
    fetchTodaysCallCounts,
    supabase,
    addParkedCallFromDb,
    removeParkedCall,
    upsertActiveCall,
    removeActiveCallForUser,
    upsertActiveCallFromActiveRow,
    removeActiveCallByCallSid,
    fetchRingingCalls,
    syncActiveCallFromRow
  ])

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

          // If incoming transfer is targeting this agent
          if (event.event_type === 'transfer_start' && event.agent_id === currentUserId) {
            console.log('🎯 Transfer incoming - preparing to receive call in my card only')
            pendingTransferToRef.current = currentUserId
            setPendingTransferTo(currentUserId)
            console.log(`✅ Set pendingTransferToRef.current = ${currentUserId}`)

            // If call already arrived (race condition), update the incoming call map to mark as transfer
            if (incomingCallMapRef.current?.[currentUserId]) {
              console.log('⚡ Call already arrived - updating to mark as transfer')
              setIncomingCallMap(prev => ({
                ...prev,
                [currentUserId]: {
                  ...prev[currentUserId],
                  isTransfer: true
                }
              }))
            }
          }

          // If someone else answered, cancel our incoming ring
          if (event.event_type === 'answered' && event.agent_id !== currentUserId) {
            console.log('🚫 Another agent answered, canceling our ring')
            setIncomingCallMap({}) // Clear incoming call UI
          }

          // If ANY agent answered (including myself), clear optimistic transfer UI
          if (event.event_type === 'answered') {
            console.log('✅ Call answered - clearing optimistic transfer UI')
            setOptimisticTransferMap({}) // Clear "transferring..." UI
          }

          // If this agent declined
          if (event.event_type === 'declined' && event.agent_id === currentUserId) {
            console.log('❌ This agent declined')
            setIncomingCallMap({}) // Clear incoming call UI
          }

          // ============================================================================
          // REALTIME SYNC FIX: Handle ring_cancel to clear ghost incoming calls
          // ============================================================================
          // When a call ends, the backend broadcasts ring_cancel event
          // This clears incoming call UI on all agents' screens
          // Prevents ghost incoming calls after one agent hangs up
          // See: app/api/twilio/update-user-call/route.ts lines 252-270
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
  }, [currentUserId, supabase])

  // Watch for incoming calls and map to agent cards
  useEffect(() => {
    if (incomingCall && !activeCall) {
      const callSid = incomingCall.parameters.CallSid

      console.log('🔍 INCOMING CALL HANDLER:', {
        hasIncomingCall: !!incomingCall,
        hasActiveCall: !!activeCall,
        pendingTransferTo,
        pendingTransferToRef: pendingTransferToRef.current,
        currentUserId,
        callSid: callSid,
        from: incomingCall?.parameters?.From,
        alreadyProcessed: processedTransferCallSids.has(callSid)
      })

      // Check if this is a transfer (use REF to prevent timing issues with state)
      if (pendingTransferToRef.current && !processedTransferCallSids.has(callSid)) {
        const targetAgentId = pendingTransferToRef.current
        console.log(`📞 Transfer/Unpark call detected - showing ONLY to agent: ${targetAgentId}`)
        console.log(`📞 Current user: ${currentUserId}`)
        console.log(`📞 Will show centralized bar: ${targetAgentId === currentUserId}`)

        // Mark this call SID as processed to prevent duplicate processing
        setProcessedTransferCallSids(prev => new Set(prev).add(callSid))
        console.log(`🔒 Marked call ${callSid} as processed transfer`)

        // Only show to the specific agent being transferred to
        const newMap: Record<string, any> = {
          [targetAgentId]: {
            callSid: callSid,
            callerNumber: incomingCall.parameters.From || 'Unknown',
            twilioCall: incomingCall,
            isTransfer: true // This is a transfer call (includes unpark)
          }
        }

        setIncomingCallMap(newMap)
        setOptimisticTransferMap({}) // Clear optimistic UI - real call has arrived
        console.log(`🔄 Transfer call mapped. Map contents:`, newMap)
        console.log(`🔄 Is current user the transfer target? ${currentUserId === targetAgentId}`)

        // Clear the ref now that we've processed it
        pendingTransferToRef.current = null
        setPendingTransferTo(null)
        console.log(`✅ Cleared pendingTransferTo after mapping transfer call`)

        // Timeout for transfer calls
        const timeoutId = setTimeout(() => {
          console.log('⏱️ Transfer call timeout - clearing UI after 45 seconds')
          setIncomingCallMap({})
        }, 45000)

        return () => clearTimeout(timeoutId)
      } else if (!processedTransferCallSids.has(callSid)) {
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
      } else {
        console.log(`⏭️ Skipping duplicate incoming call event for ${callSid}`)
      }
    } else if (!incomingCall || activeCall) {
      // Clear incoming call map when call is answered or ended
      setIncomingCallMap({})
      // DON'T clear pendingTransferToRef here - it should only be cleared after processing the transfer
      // This prevents timing issues where cleanup clears the ref before the new call arrives
      console.log('🧹 Cleared incoming call map (call answered/ended)')
    }
  }, [incomingCall, activeCall, users, pendingTransferTo, processedTransferCallSids, currentUserId])

  const handleAnswerCall = async () => {
    console.log('🚀 handleAnswerCall CALLED', {
      hasIncomingCall: !!incomingCall,
      hasCurrentUserId: !!currentUserId,
      currentUserId,
      callSid: incomingCall?.parameters?.CallSid
    })

    if (!incomingCall || !currentUserId) {
      console.log('❌ ABORT: Missing incomingCall or currentUserId')
      return
    }

    console.log('📞 Attempting to answer call')

    try {
      // CRITICAL FIX: Accept call FIRST to establish audio
      // This gives us access to the Call object with parentCallSid
      console.log('🎧 Accepting call to establish audio connection')
      await acceptCall()

      console.log('📞 Call accepted, audio connected')

      // Now check if we need to claim (in case another agent also answered)
      // Use a small delay to let Twilio events propagate
      setTimeout(async () => {
        try {
          const callSid = incomingCall.parameters.CallSid

          console.log('🔄 Sending claim-call API request', { callSid, agentId: currentUserId })

          const claimResponse = await fetch('/api/twilio/claim-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callSid: callSid,
              agentId: currentUserId
            })
          })

          const claimResult = await claimResponse.json()
          console.log('📥 claim-call API response', { status: claimResponse.status, result: claimResult })

          if (!claimResult.success) {
            console.log('⚠️ Another agent claimed - they will keep the call')
            // Another agent claimed it, so disconnect our call
            if (activeCall) {
              activeCall.disconnect()
            }
          } else {
            console.log('✅ Successfully claimed call')
          }
        } catch (error) {
          console.error('❌ Error in post-answer claim:', error)
        }
      }, 100)

      setIncomingCallMap({})

    } catch (error) {
      console.error('❌ Error answering call:', error)
      setIncomingCallMap({})
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

        // Clear any lingering incoming call UI from when this call first rang
        setIncomingCallMap({})
        console.log('🧹 Cleared incoming call map (parking call)')

        // Optimistically add to parking lot (parker's screen only - for immediate feedback)
        const tempId = `temp-park-${Date.now()}`
        const optimisticParkedCall = {
          id: tempId,
          callObject: null,
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

        addParkedCall(optimisticParkedCall)
        console.log('⚡ Optimistically added to parking lot (temp ID:', tempId, ')')

        // Call park API - this will:
        // 1. Insert into database (all browsers will see INSERT event via Supabase realtime)
        // 2. Redirect the PSTN parent call to conference/hold music
        console.log('Calling park API...')
        const response = await fetch('/api/twilio/park-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callSid: callSid,
            userId: currentUserId,
            userName: users.find(u => u.id === currentUserId)?.full_name,
            callerNumber: callerNumber,
            callId: null,
            tempId: tempId, // Pass temp ID so we can dedupe later
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          // Rollback optimistic add
          removeParkedCall(tempId)
          throw new Error(data.error || 'Failed to park call')
        }

        console.log('✅ Call parked successfully - caller will hear hold music')
        console.log('Real parked call ID from server:', data.parkedCallId)

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
        // Get caller number from parked call
        const parkedCall = getParkedCall(parkedCallId)
        const callerNumber = parkedCall?.callerId || 'Unknown'

        // IMMEDIATELY show optimistic "transferring..." UI in target agent card
        setOptimisticTransferMap({
          [newAgentId]: {
            callerNumber: callerNumber,
            isLoading: true
          }
        })
        console.log(`⚡ Showing optimistic transfer UI for agent: ${newAgentId}`)

        // Set pending transfer state BEFORE calling unpark API (both state and ref)
        setPendingTransferTo(newAgentId)
        pendingTransferToRef.current = newAgentId
        console.log(`🔄 Set pending transfer to agent: ${newAgentId}`)
        console.log(`🔄 Set pendingTransferToRef.current: ${newAgentId}`)

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
          pendingTransferToRef.current = null
          setOptimisticTransferMap({}) // Clear optimistic UI
          throw new Error(data.error || 'Failed to unpark call')
        }

        console.log('✅ Call unparked successfully - waiting for Twilio to connect')
        // Don't call fetchUsers() - real-time subscriptions will update automatically
        // Don't clear pendingTransferTo here - wait for incoming call event
        // Optimistic UI will be cleared when real incoming call arrives
      } catch (error: any) {
        console.error('❌ Error unparking call:', error)
        setOptimisticTransferMap({}) // Clear optimistic UI on error
        alert(`Failed to retrieve call: ${error.message}`)
      }
    }
  }

  const availableCount = users.filter(u => u.is_available).length
  const onCallCount = users.filter(u => u.current_call_id).length

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <header className="backdrop-blur-lg bg-white/70 border-b border-white/20 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <Link
                  href="/super-admin/dashboard"
                  className="text-slate-600 hover:text-slate-900 transition-colors text-sm sm:text-base"
                >
                  ← Back to Dashboard
                </Link>
                {/* Twilio Device Status */}
                <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-full">
                  <div className={`w-2 h-2 rounded-full ${isRegistered ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="text-xs sm:text-sm text-slate-700 font-medium">
                    {isRegistered ? 'Ready to receive calls' : 'Connecting...'}
                  </span>
                </div>
                {twilioError && (
                  <span className="text-xs sm:text-sm text-red-600 bg-red-50 px-3 py-1 rounded-full">Error: {twilioError}</span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 bg-gradient-to-r from-slate-900 to-blue-900 bg-clip-text text-transparent">Team Calling Dashboard</h1>
              <p className="text-xs sm:text-sm text-slate-600">Manage agents and route calls in real-time</p>
            </div>
            {currentUserRole === 'super_admin' && (
              <Link
                href="/super-admin/agents"
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm hover:shadow-md transition-all text-sm sm:text-base"
              >
                Manage Agents
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="container mx-auto px-4 sm:px-6 pb-72 lg:pb-8 lg:pr-64 pt-3 sm:pt-6">
        <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:gap-6 mb-3 sm:mb-6 lg:mb-8">
          <div className="backdrop-blur-lg bg-white/70 rounded-lg sm:rounded-xl shadow-sm sm:shadow-lg border border-white/20 p-2 sm:p-4 lg:p-6 hover:shadow-xl transition-all">
            <div className="text-[9px] sm:text-xs lg:text-sm text-slate-600 mb-0.5 sm:mb-1 font-medium uppercase tracking-wide">Agents</div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-bold text-slate-900">{users.length}</div>
            <div className="hidden sm:flex mt-2 items-center gap-1.5">
              <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
              <span className="text-xs text-slate-500">All users</span>
            </div>
          </div>
          <div className="backdrop-blur-lg bg-white/70 rounded-lg sm:rounded-xl shadow-sm sm:shadow-lg border border-white/20 p-2 sm:p-4 lg:p-6 hover:shadow-xl transition-all">
            <div className="text-[9px] sm:text-xs lg:text-sm text-slate-600 mb-0.5 sm:mb-1 font-medium uppercase tracking-wide">Available</div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">{availableCount}</div>
            <div className="hidden sm:flex mt-2 items-center gap-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-700">Ready</span>
            </div>
          </div>
          <div className="backdrop-blur-lg bg-white/70 rounded-lg sm:rounded-xl shadow-sm sm:shadow-lg border border-white/20 p-2 sm:p-4 lg:p-6 hover:shadow-xl transition-all">
            <div className="text-[9px] sm:text-xs lg:text-sm text-slate-600 mb-0.5 sm:mb-1 font-medium uppercase tracking-wide">On Call</div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">{onCallCount}</div>
            <div className="hidden sm:flex mt-2 items-center gap-1.5">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-blue-700">Active</span>
            </div>
          </div>
          <div className="backdrop-blur-lg bg-white/70 rounded-lg sm:rounded-xl shadow-sm sm:shadow-lg border border-white/20 p-2 sm:p-4 lg:p-6 hover:shadow-xl transition-all">
            <div className="text-[9px] sm:text-xs lg:text-sm text-slate-600 mb-0.5 sm:mb-1 font-medium uppercase tracking-wide">Offline</div>
            <div className="text-lg sm:text-2xl lg:text-3xl font-bold text-slate-400">
              {users.length - availableCount - onCallCount}
            </div>
            <div className="hidden sm:flex mt-2 items-center gap-1.5">
              <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
              <span className="text-xs text-slate-500">Unavailable</span>
            </div>
          </div>
        </div>

        {/* Multi-Agent Incoming Call Bar - ONLY for multi-agent ring (not transfers) */}
        {incomingCall && !activeCall && currentUserId && incomingCallMap[currentUserId] && !incomingCallMap[currentUserId].isTransfer && (() => {
          const formatPhoneNumber = (phone: string) => {
            const digits = phone.replace(/\D/g, '')
            if (digits.length === 11 && digits[0] === '1') {
              const number = digits.slice(1)
              return `${number.slice(0, 3)}-${number.slice(3, 6)}-${number.slice(6)}`
            } else if (digits.length === 10) {
              return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
            }
            return phone.replace('+', '')
          }

          return (
          <div className="mb-6 backdrop-blur-md bg-gradient-to-br from-blue-50/90 to-indigo-50/90 border-2 border-blue-400 rounded-2xl shadow-2xl shadow-blue-200/50 p-4 sm:p-6 animate-pulse">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                  <svg className="w-6 h-6 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-blue-700 uppercase tracking-wide mb-0.5">Incoming Call</p>
                  <p className="text-xl sm:text-2xl font-bold font-mono text-blue-900">{formatPhoneNumber(incomingCallMap[currentUserId].callerNumber)}</p>
                </div>
              </div>
              <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  onClick={handleAnswerCall}
                  className="flex-1 sm:flex-initial bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="hidden sm:inline">Answer</span>
                  <span className="sm:hidden">Accept</span>
                </button>
                <button
                  onClick={handleDeclineCall}
                  className="flex-1 sm:flex-initial bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 sm:py-4 px-6 sm:px-8 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Decline</span>
                </button>
              </div>
            </div>
          </div>
          )
        })()}

        {/* Agent Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="backdrop-blur-lg bg-white/70 rounded-2xl shadow-lg border border-white/20 p-8 inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <div className="text-slate-700 font-medium">Loading agents...</div>
            </div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <div className="backdrop-blur-lg bg-white/70 rounded-2xl shadow-lg border border-white/20 p-8 max-w-md mx-auto">
              <div className="w-16 h-16 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="text-slate-700 font-semibold text-lg mb-2">No agents yet</div>
              <div className="text-slate-500 text-sm mb-6">Get started by adding your first agent to the team</div>
              {currentUserRole === 'super_admin' && (
                <Link
                  href="/super-admin/agents"
                  className="inline-block bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-medium shadow-sm hover:shadow-md transition-all"
                >
                  Add Your First Agent
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map(user => {
              const remoteActiveCall = activeCallsByUser.get(user.id)

              return (
                <AgentCard
                  key={user.id}
                  user={user}
                  onToggleAvailability={handleToggleAvailability}
                  onCall={handleCall}
                  activeCall={
                    user.id === currentUserId
                      ? activeCall // Current user ONLY: use LOCAL Twilio Call object
                      : null // Remote users: NO activeCall object (they can't control it)
                  }
                  callStartTime={
                    user.id === currentUserId
                      ? callStartTime
                      : remoteActiveCall?.answeredAt ?? null // Remote users: timestamp from store
                  }
                  incomingCall={incomingCallMap[user.id]}
                  optimisticTransfer={optimisticTransferMap[user.id]}
                  onAnswerCall={
                    // Pass callback if this user has an incoming call (regular or transfer)
                    incomingCallMap[user.id]
                      ? (() => {
                          console.log('🟢 PASS onAnswerCall: User has incoming call', {
                            userId: user.id,
                            userEmail: user.email,
                            incomingCall: incomingCallMap[user.id]
                          })
                          return handleAnswerCall
                        })()
                      : (() => {
                          console.log('⚪ SKIP onAnswerCall: No incoming call for user', {
                            userId: user.id,
                            userEmail: user.email
                          })
                          return undefined
                        })()
                  }
                  onDeclineCall={
                    // Pass callback if this user has an incoming call (regular or transfer)
                    incomingCallMap[user.id]
                      ? handleDeclineCall
                      : undefined
                  }
                  activeCalls={user.id === currentUserId ? activeCalls : undefined}
                  selectedCallId={user.id === currentUserId ? selectedCallId : undefined}
                  onHoldCall={user.id === currentUserId ? holdCall : undefined}
                  onResumeCall={user.id === currentUserId ? resumeCall : undefined}
                  onEndCall={user.id === currentUserId ? endCall : undefined}
                  incomingCallsCount={callCountsByUser[user.id]?.incoming || 0}
                  outboundCallsCount={callCountsByUser[user.id]?.outbound || 0}
                />
              )
            })}
          </div>
        )}

        {/* Call History Card - Below all agents */}
        {!isLoading && users.length > 0 && (
          <div className="mt-6">
            <CallHistoryCard />
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

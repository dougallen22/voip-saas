import { useEffect, useState, useRef } from 'react'
import { Device, Call } from '@twilio/voice-sdk'

interface CallState {
  call: Call
  callSid: string
  startTime: Date
  isOnHold: boolean
}

export function useTwilioDevice() {
  const [device, setDevice] = useState<Device | null>(null)
  const [incomingCall, setIncomingCall] = useState<Call | null>(null) // Keep for backward compatibility
  const [activeCall, setActiveCall] = useState<Call | null>(null) // Keep for backward compatibility
  const [activeCalls, setActiveCalls] = useState<CallState[]>([]) // NEW: Array of all calls
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null) // NEW: Currently active (not on hold)
  const [isRegistered, setIsRegistered] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [callStartTime, setCallStartTime] = useState<Date | null>(null) // Keep for backward compatibility
  const deviceRef = useRef<Device | null>(null)
  const userIdRef = useRef<string | null>(null) // Store userId in ref for event handlers

  useEffect(() => {
    let mounted = true

    async function initializeDevice() {
      try {
        // Fetch access token from server
        const response = await fetch('/api/twilio/token')
        if (!response.ok) throw new Error('Failed to fetch token')

        const data = await response.json()
        console.log('Got Twilio token for identity:', data.identity)
        setCurrentUserId(data.identity)
        userIdRef.current = data.identity // Store in ref for event handlers

        // Create and setup device
        const twilioDevice = new Device(data.token, {
          logLevel: 1, // Debug level
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        })

        // Set up event listeners
        twilioDevice.on('registered', () => {
          console.log('✅ Twilio Device registered and ready to receive calls')
          if (mounted) setIsRegistered(true)
        })

        twilioDevice.on('unregistered', () => {
          console.log('❌ Twilio Device unregistered')
          if (mounted) setIsRegistered(false)
        })

        twilioDevice.on('error', (error) => {
          console.error('Twilio Device Error:', error)
          if (mounted) setError(error.message)
        })

        twilioDevice.on('incoming', (call) => {
          console.log('📞 INCOMING CALL from:', call.parameters.From)
          if (mounted) {
            const callSid = call.parameters.CallSid

            // Backward compatibility - set single incoming call state
            setIncomingCall(call)

            // Set up call event listeners
            call.on('accept', async () => {
              console.log('✅ Call accepted by Twilio:', callSid)
              if (mounted) {
                // Update database to show this user is on a call
                // This ensures ALL users see the active call in this agent's card
                if (userIdRef.current) {
                  try {
                    console.log('📥 Updating database - setting current_call_id for agent')
                    const response = await fetch('/api/twilio/update-user-call', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        callSid: callSid,
                        agentId: userIdRef.current,
                        action: 'start'
                      })
                    })
                    const result = await response.json()
                    if (result.success) {
                      console.log('✅ Database updated - current_call_id set, ALL users will see active call!')
                    } else {
                      console.error('❌ Failed to update database:', result.error)
                    }
                  } catch (error) {
                    console.error('❌ Error updating database:', error)
                  }
                }

                const newCallState: CallState = {
                  call,
                  callSid,
                  startTime: new Date(),
                  isOnHold: false
                }

                // Add to activeCalls array
                setActiveCalls(prev => {
                  // If there are existing calls, put them on hold
                  const updatedPrev = prev.map(c => ({ ...c, isOnHold: true }))
                  return [...updatedPrev, newCallState]
                })

                // Set as selected call
                setSelectedCallId(callSid)

                // Backward compatibility
                setActiveCall(call)
                setIncomingCall(null)
                setCallStartTime(new Date())
              }
            })

            call.on('disconnect', async () => {
              console.log('Call disconnected:', callSid)
              if (mounted) {
                // Update database to clear current_call_id
                // This ensures ALL users see the call ended in this agent's card
                if (userIdRef.current) {
                  try {
                    console.log('📥 Updating database - clearing current_call_id for agent')
                    const response = await fetch('/api/twilio/update-user-call', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        callSid: callSid,
                        agentId: userIdRef.current,
                        action: 'end'
                      })
                    })
                    const result = await response.json()
                    if (result.success) {
                      console.log('✅ Database updated - current_call_id cleared, ALL users will see call ended!')
                    } else {
                      console.error('❌ Failed to update database:', result.error)
                    }
                  } catch (error) {
                    console.error('❌ Error updating database:', error)
                  }
                }

                // Remove from activeCalls array
                setActiveCalls(prev => {
                  const filtered = prev.filter(c => c.callSid !== callSid)

                  // If this was the selected call and there are other calls, select the first one
                  if (selectedCallId === callSid && filtered.length > 0) {
                    setSelectedCallId(filtered[0].callSid)
                    // Resume first remaining call
                    filtered[0].call.mute(false)
                    filtered[0].isOnHold = false
                  }

                  return filtered
                })

                // Clear selected if this was it
                if (selectedCallId === callSid) {
                  setSelectedCallId(null)
                }

                // Backward compatibility
                setIncomingCall(null)
                setActiveCall(null)
                setCallStartTime(null)
              }
            })

            call.on('reject', () => {
              console.log('Call rejected:', callSid)
              if (mounted) {
                setIncomingCall(null)
              }
            })
          }
        })

        // Register the device
        await twilioDevice.register()

        if (mounted) {
          setDevice(twilioDevice)
          deviceRef.current = twilioDevice
        }
      } catch (err: any) {
        console.error('❌ TWILIO DEVICE INITIALIZATION ERROR:', err)
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
          name: err.name
        })
        if (mounted) setError(err.message)
      }
    }

    initializeDevice()

    return () => {
      mounted = false
      if (deviceRef.current) {
        deviceRef.current.unregister()
        deviceRef.current.destroy()
      }
    }
  }, [])

  const acceptCall = () => {
    if (incomingCall) {
      incomingCall.accept()
    }
  }

  const rejectCall = () => {
    if (incomingCall) {
      console.log('Rejecting call...')
      try {
        incomingCall.reject()
      } catch (error) {
        console.error('Error rejecting call:', error)
        // If reject fails, try disconnect
        try {
          incomingCall.disconnect()
        } catch (disconnectError) {
          console.error('Error disconnecting call:', disconnectError)
        }
      }
      setIncomingCall(null)
    }
  }

  // NEW: Hold a specific call (mute audio)
  const holdCall = (callSid: string) => {
    console.log('Holding call:', callSid)
    setActiveCalls(prev => prev.map(c => {
      if (c.callSid === callSid) {
        c.call.mute(true)
        return { ...c, isOnHold: true }
      }
      return c
    }))
  }

  // NEW: Resume a specific call (unmute, hold all others)
  const resumeCall = (callSid: string) => {
    console.log('Resuming call:', callSid)
    setActiveCalls(prev => prev.map(c => {
      if (c.callSid === callSid) {
        c.call.mute(false)
        setSelectedCallId(callSid)
        return { ...c, isOnHold: false }
      } else {
        c.call.mute(true)
        return { ...c, isOnHold: true }
      }
    }))
  }

  // NEW: Switch to a different call (resume it, hold all others)
  const switchToCall = (callSid: string) => {
    resumeCall(callSid)
  }

  // NEW: End a specific call
  const endCall = (callSid: string) => {
    console.log('Ending call:', callSid)
    const callState = activeCalls.find(c => c.callSid === callSid)
    if (callState) {
      callState.call.disconnect()
    }
  }

  return {
    device,
    incomingCall,
    activeCall,
    activeCalls, // NEW
    selectedCallId, // NEW
    isRegistered,
    error,
    currentUserId,
    callStartTime,
    acceptCall,
    rejectCall,
    holdCall, // NEW
    resumeCall, // NEW
    switchToCall, // NEW
    endCall, // NEW
  }
}

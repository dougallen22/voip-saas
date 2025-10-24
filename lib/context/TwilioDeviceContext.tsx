'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { Device, Call } from '@twilio/voice-sdk'
import { formatToE164 } from '@/lib/utils/phoneFormatter'

interface CallState {
  call: Call
  callSid: string
  startTime: Date
  isOnHold: boolean
}

interface ContactInfo {
  id: string
  name: string           // "John Doe"
  displayName: string    // Prefer business_name, fallback to full name
  firstName: string
  lastName: string
  businessName: string | null
}

interface TwilioDeviceContextType {
  device: Device | null
  incomingCall: Call | null
  activeCall: Call | null
  activeCalls: CallState[]
  selectedCallId: string | null
  isRegistered: boolean
  error: string | null
  currentUserId: string | null
  callStartTime: Date | null
  outboundCall: Call | null
  outboundCallStatus: string | null
  incomingCallContact: ContactInfo | null
  activeCallContact: ContactInfo | null
  acceptCall: () => void
  rejectCall: () => void
  holdCall: (callSid: string) => void
  resumeCall: (callSid: string) => void
  switchToCall: (callSid: string) => void
  endCall: (callSid: string) => void
  makeOutboundCall: (phoneNumber: string, contactName: string) => Promise<Call>
}

const TwilioDeviceContext = createContext<TwilioDeviceContextType | undefined>(undefined)

export function TwilioDeviceProvider({ children }: { children: ReactNode }) {
  const [device, setDevice] = useState<Device | null>(null)
  const [incomingCall, setIncomingCall] = useState<Call | null>(null)
  const [activeCall, setActiveCall] = useState<Call | null>(null)
  const [activeCalls, setActiveCalls] = useState<CallState[]>([])
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null)
  const [isRegistered, setIsRegistered] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [callStartTime, setCallStartTime] = useState<Date | null>(null)
  const [outboundCall, setOutboundCall] = useState<Call | null>(null)
  const [outboundCallStatus, setOutboundCallStatus] = useState<string | null>(null)
  const [incomingCallContact, setIncomingCallContact] = useState<ContactInfo | null>(null)
  const [activeCallContact, setActiveCallContact] = useState<ContactInfo | null>(null)

  // Refs to avoid closure issues in event handlers
  const incomingCallContactRef = useRef<ContactInfo | null>(null)
  const activeCallContactRef = useRef<ContactInfo | null>(null)
  const deviceRef = useRef<Device | null>(null)
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true
    let refreshTimer: NodeJS.Timeout | null = null

    async function refreshToken() {
      try {
        console.log('🔄 Periodic token refresh triggered')
        const response = await fetch('/api/twilio/token')
        if (!response.ok) {
          throw new Error('Failed to fetch refresh token')
        }
        const data = await response.json()

        if (deviceRef.current) {
          deviceRef.current.updateToken(data.token)
          console.log('✅ Token refreshed successfully (periodic)')
        }
      } catch (error) {
        console.error('❌ Failed to refresh token (periodic):', error)
      }
    }

    async function initializeDevice() {
      try {
        // Fetch access token from server
        const response = await fetch('/api/twilio/token')
        if (!response.ok) throw new Error('Failed to fetch token')

        const data = await response.json()
        console.log('Got Twilio token for identity:', data.identity)
        setCurrentUserId(data.identity)
        userIdRef.current = data.identity

        // Create and setup device with token refresh configuration
        const twilioDevice = new Device(data.token, {
          logLevel: 1,
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          tokenRefreshMs: 30000,
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

        // Handle token expiration by fetching a new token
        twilioDevice.on('tokenWillExpire', async () => {
          console.log('⏰ Token will expire soon (30s warning), fetching new token...')
          try {
            const response = await fetch('/api/twilio/token')
            if (!response.ok) {
              throw new Error(`Failed to fetch refresh token: ${response.status}`)
            }
            const data = await response.json()

            if (!data.token) {
              throw new Error('No token in response')
            }

            twilioDevice.updateToken(data.token)
            console.log('✅ Token refreshed successfully via tokenWillExpire event')
          } catch (error) {
            console.error('❌ Failed to refresh token via tokenWillExpire:', error)
            if (mounted) setError('Failed to refresh authentication token')

            setTimeout(async () => {
              try {
                console.log('🔄 Retrying token refresh...')
                const retryResponse = await fetch('/api/twilio/token')
                const retryData = await retryResponse.json()
                twilioDevice.updateToken(retryData.token)
                console.log('✅ Token refreshed successfully on retry')
                if (mounted) setError(null)
              } catch (retryError) {
                console.error('❌ Token refresh retry failed:', retryError)
              }
            }, 2000)
          }
        })

        twilioDevice.on('tokenExpired', () => {
          console.error('💥 TOKEN EXPIRED! This should not happen - tokenWillExpire should have refreshed it.')
          if (mounted) setError('Token expired - please refresh the page')
        })

        twilioDevice.on('incoming', async (call) => {
          console.log('📞 INCOMING CALL from:', call.parameters.From)
          if (mounted) {
            const callSid = call.parameters.CallSid
            const phoneNumber = call.parameters.From

            // Lookup contact by phone number
            try {
              const apiUrl = `/api/contacts/lookup-by-phone?phone=${encodeURIComponent(phoneNumber)}`
              console.log('🔍 Looking up contact for:', phoneNumber)
              console.log('   API URL:', apiUrl)

              const response = await fetch(apiUrl)

              console.log('📡 API Response status:', response.status, response.statusText)

              if (!response.ok) {
                const errorText = await response.text()
                console.error('❌ API request failed:', errorText)
                setIncomingCallContact(null)
                return
              }

              const data = await response.json()
              console.log('📦 API Response data:', data)

              if (data.contact) {
                const fullName = `${data.contact.first_name} ${data.contact.last_name}`
                const displayName = data.contact.business_name || fullName

                const contactInfo = {
                  id: data.contact.id,
                  name: fullName,
                  displayName: displayName,
                  firstName: data.contact.first_name,
                  lastName: data.contact.last_name,
                  businessName: data.contact.business_name
                }

                console.log('✅ Contact found! Setting state:', contactInfo)
                setIncomingCallContact(contactInfo)
                incomingCallContactRef.current = contactInfo // Keep ref in sync
                console.log('✅ incomingCallContact state updated to:', contactInfo.displayName)
              } else {
                setIncomingCallContact(null)
                incomingCallContactRef.current = null // Keep ref in sync
                console.log('❓ Unknown caller - no contact in database')
              }
            } catch (error) {
              console.error('❌ EXCEPTION during contact lookup:', error)
              console.error('   Error details:', {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
              })
              setIncomingCallContact(null)
              incomingCallContactRef.current = null // Keep ref in sync
            }

            setIncomingCall(call)

            call.on('accept', async () => {
              console.log('✅ Call accepted by Twilio:', callSid)
              if (mounted) {
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

                setActiveCalls(prev => {
                  const updatedPrev = prev.map(c => ({ ...c, isOnHold: true }))
                  return [...updatedPrev, newCallState]
                })

                setSelectedCallId(callSid)
                setActiveCall(call)
                setIncomingCall(null)
                setCallStartTime(new Date())

                // Persist contact info from incoming → active (use ref to avoid closure issues)
                const currentContact = incomingCallContactRef.current
                console.log('🔄 Transferring contact from incoming to active:', currentContact?.displayName || 'none')
                setActiveCallContact(currentContact)
                activeCallContactRef.current = currentContact // Keep ref in sync
                setIncomingCallContact(null)
                incomingCallContactRef.current = null // Keep ref in sync
              }
            })

            call.on('disconnect', async () => {
              console.log('📴 Call disconnected:', callSid)
              if (mounted) {
                if (userIdRef.current) {
                  try {
                    console.log('📥 CRITICAL: Clearing database on disconnect', {
                      callSid,
                      agentId: userIdRef.current,
                      timestamp: new Date().toISOString()
                    })
                    const response = await fetch('/api/twilio/update-user-call', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        callSid: callSid,
                        agentId: userIdRef.current,
                        action: 'end'
                      })
                    })

                    if (!response.ok) {
                      console.error('❌ API request failed:', response.status, response.statusText)
                      const errorText = await response.text()
                      console.error('❌ Error response:', errorText)
                      return
                    }

                    const result = await response.json()
                    if (result.success) {
                      console.log('✅ Database updated - current_call_id cleared, ALL users will see call ended!')
                    } else {
                      console.error('❌ API returned success=false:', result.error)
                    }
                  } catch (error) {
                    console.error('❌ CRITICAL ERROR updating database on disconnect:', error)
                    console.error('❌ This will cause stuck "On Call" status!')
                  }
                } else {
                  console.warn('⚠️ No userIdRef.current on disconnect - cannot clear database!')
                }

                setActiveCalls(prev => {
                  const filtered = prev.filter(c => c.callSid !== callSid)

                  if (selectedCallId === callSid && filtered.length > 0) {
                    setSelectedCallId(filtered[0].callSid)
                    filtered[0].call.mute(false)
                    filtered[0].isOnHold = false
                  }

                  return filtered
                })

                if (selectedCallId === callSid) {
                  setSelectedCallId(null)
                }

                setIncomingCall(null)
                setActiveCall(null)
                setCallStartTime(null)
                setActiveCallContact(null)
                activeCallContactRef.current = null // Keep ref in sync
              }
            })

            call.on('reject', () => {
              console.log('Call rejected:', callSid)
              if (mounted) {
                setIncomingCall(null)
                setIncomingCallContact(null)
                incomingCallContactRef.current = null // Keep ref in sync
              }
            })

            call.on('cancel', () => {
              console.log('📴 Call canceled (caller hung up before answer):', callSid)
              if (mounted) {
                setIncomingCall(null)
                setIncomingCallContact(null)
                incomingCallContactRef.current = null // Keep ref in sync
              }
            })
          }
        })

        // Register the device
        await twilioDevice.register()

        if (mounted) {
          setDevice(twilioDevice)
          deviceRef.current = twilioDevice

          const REFRESH_INTERVAL = 3.5 * 60 * 60 * 1000
          refreshTimer = setInterval(refreshToken, REFRESH_INTERVAL)
          console.log('⏲️ Periodic token refresh scheduled every 3.5 hours')
        }
      } catch (err: any) {
        console.error('❌ TWILIO DEVICE INITIALIZATION ERROR:', err)
        if (mounted) setError(err.message)
      }
    }

    initializeDevice()

    // Cleanup ONLY on:
    // 1. Component unmount (app closed)
    // 2. User logout (handled separately)
    // NOT on page navigation!
    return () => {
      mounted = false

      if (refreshTimer) {
        clearInterval(refreshTimer)
        console.log('🧹 Cleared periodic token refresh timer')
      }

      // Only destroy if we're truly unmounting (app closing)
      // NOT just navigating between pages
      // This cleanup runs when the provider unmounts (user closes browser/tab)
      if (deviceRef.current) {
        console.log('🧹 TwilioDeviceProvider unmounting - cleaning up device')
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
        try {
          incomingCall.disconnect()
        } catch (disconnectError) {
          console.error('Error disconnecting call:', disconnectError)
        }
      }
      setIncomingCall(null)
    }
  }

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

  const switchToCall = (callSid: string) => {
    resumeCall(callSid)
  }

  const endCall = (callSid: string) => {
    console.log('Ending call:', callSid)
    const callState = activeCalls.find(c => c.callSid === callSid)
    if (callState) {
      callState.call.disconnect()
    }
  }

  const makeOutboundCall = async (phoneNumber: string, contactName: string) => {
    if (!device) {
      throw new Error('Device not ready. Please refresh the page.')
    }

    if (!isRegistered) {
      throw new Error('Device not registered. Please wait a moment and try again.')
    }

    try {
      console.log('📞 Initiating outbound call to:', phoneNumber, 'Contact:', contactName)

      const formattedPhone = formatToE164(phoneNumber)

      setOutboundCallStatus('connecting')

      const call = await device.connect({
        params: {
          To: formattedPhone,
          contactName: contactName || 'Unknown'
        }
      })

      console.log('✅ Call initiated, CallSid:', call.parameters.CallSid)
      setOutboundCall(call)

      call.on('ringing', (hasEarlyMedia: boolean) => {
        console.log('📞 Call is ringing...', hasEarlyMedia ? '(with early media)' : '')
        setOutboundCallStatus('ringing')
      })

      call.on('accept', async () => {
        console.log('✅ Call accepted (answered)')
        setOutboundCallStatus('answered')
        setActiveCall(call)
        setCallStartTime(new Date())

        if (userIdRef.current) {
          try {
            const callSid = call.parameters.CallSid
            await fetch('/api/twilio/update-user-call', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                callSid: callSid,
                agentId: userIdRef.current,
                action: 'start'
              })
            })
          } catch (error) {
            console.error('❌ Failed to update user call status:', error)
          }
        }
      })

      call.on('disconnect', async () => {
        console.log('📴 Outbound call disconnected')
        setOutboundCallStatus('ended')
        setOutboundCall(null)
        setActiveCall(null)
        setCallStartTime(null)
        setActiveCallContact(null)
        activeCallContactRef.current = null // Keep ref in sync

        if (userIdRef.current) {
          try {
            const callSid = call.parameters.CallSid
            console.log('📥 CRITICAL: Clearing database on outbound disconnect', {
              callSid,
              agentId: userIdRef.current,
              timestamp: new Date().toISOString()
            })
            const response = await fetch('/api/twilio/update-user-call', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                callSid: callSid,
                agentId: userIdRef.current,
                action: 'end'
              })
            })

            if (!response.ok) {
              console.error('❌ API request failed:', response.status, response.statusText)
              const errorText = await response.text()
              console.error('❌ Error response:', errorText)
              return
            }

            const result = await response.json()
            if (result.success) {
              console.log('✅ Database updated - outbound call cleaned up!')
            } else {
              console.error('❌ API returned success=false:', result.error)
            }
          } catch (error) {
            console.error('❌ CRITICAL ERROR clearing outbound call status:', error)
            console.error('❌ This will cause stuck "On Call" status!')
          }
        } else {
          console.warn('⚠️ No userIdRef.current on outbound disconnect - cannot clear database!')
        }
      })

      call.on('cancel', () => {
        console.log('⚠️ Call canceled')
        setOutboundCallStatus('ended')
        setOutboundCall(null)
        setActiveCall(null)
      })

      call.on('error', (error) => {
        console.error('❌ Call error:', error)
        setError(error.message)
        setOutboundCallStatus('ended')
        setOutboundCall(null)
        setActiveCall(null)
      })

      return call
    } catch (error: any) {
      console.error('❌ Error making outbound call:', error)
      setOutboundCallStatus('ended')
      setError(error.message)
      throw error
    }
  }

  const value: TwilioDeviceContextType = {
    device,
    incomingCall,
    activeCall,
    activeCalls,
    selectedCallId,
    isRegistered,
    error,
    currentUserId,
    callStartTime,
    outboundCall,
    outboundCallStatus,
    incomingCallContact,
    activeCallContact,
    acceptCall,
    rejectCall,
    holdCall,
    resumeCall,
    switchToCall,
    endCall,
    makeOutboundCall,
  }

  return (
    <TwilioDeviceContext.Provider value={value}>
      {children}
    </TwilioDeviceContext.Provider>
  )
}

export function useTwilioDevice() {
  const context = useContext(TwilioDeviceContext)
  if (context === undefined) {
    throw new Error('useTwilioDevice must be used within a TwilioDeviceProvider')
  }
  return context
}

'use client'

import { useState, useEffect } from 'react'
import { useDroppable, useDraggable } from '@dnd-kit/core'
import IncomingCallCard from './IncomingCallCard'
import TransferCallCard from './TransferCallCard'
import UnifiedActiveCallCard from './UnifiedActiveCallCard'

interface CallState {
  call: any
  callSid: string
  startTime: Date
  isOnHold: boolean
}

interface AgentCardProps {
  user: {
    id: string
    email: string
    full_name: string
    is_available: boolean
    current_call_id?: string
    current_call_phone_number?: string | null
  }
  onToggleAvailability: (userId: string, newStatus: boolean) => void
  onCall: (userId: string) => void
  activeCall?: any
  callStartTime?: Date | null
  incomingCall?: {
    callSid: string
    callerNumber: string
    twilioCall: any
  }
  optimisticTransfer?: {
    callerNumber: string
    isLoading: boolean
  }
  onAnswerCall?: () => void
  onDeclineCall?: () => void
  // NEW: Multi-call props
  activeCalls?: CallState[]
  selectedCallId?: string | null
  onHoldCall?: (callSid: string) => void
  onResumeCall?: (callSid: string) => void
  onEndCall?: (callSid: string) => void
  // Call counts for today
  incomingCallsCount?: number
  outboundCallsCount?: number
}

export default function AgentCard({
  user,
  onToggleAvailability,
  onCall,
  activeCall,
  callStartTime,
  incomingCall,
  optimisticTransfer,
  onAnswerCall,
  onDeclineCall,
  activeCalls = [],
  selectedCallId,
  onHoldCall,
  onResumeCall,
  onEndCall,
  incomingCallsCount = 0,
  outboundCallsCount = 0
}: AgentCardProps) {
  // Make agent card droppable - only accept calls when agent is available and not busy
  const canAcceptCall = user.is_available && !activeCall && !user.current_call_id

  const { setNodeRef, isOver } = useDroppable({
    id: `agent-${user.id}`,
    data: {
      accepts: ['call'],
      agentId: user.id,
      agentName: user.full_name,
      canAccept: canAcceptCall,
    },
    disabled: !canAcceptCall,
  })

  // Make active call draggable
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id: `active-call-${user.id}`,
    data: {
      type: 'call',
      callObject: activeCall,
      callerId: activeCall?.parameters?.From || user.current_call_phone_number || 'Unknown',
      agentId: user.id,
      agentName: user.full_name,
      isParked: false,
    },
    disabled: !activeCall,
  })

  const getStatusColor = () => {
    if (activeCall || user.current_call_id) return 'bg-green-500 animate-pulse'
    if (user.is_available) return 'bg-green-500'
    return 'bg-gray-400'
  }

  const getStatusText = () => {
    if (activeCall || user.current_call_id) return 'On Call'
    if (user.is_available) return 'Available'
    return 'Offline'
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '')

    // Handle US numbers (10 or 11 digits)
    if (digits.length === 11 && digits[0] === '1') {
      // Remove leading 1
      const number = digits.slice(1)
      return `${number.slice(0, 3)}-${number.slice(3, 6)}-${number.slice(6)}`
    } else if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    }

    // Return original if not a standard format
    return phone.replace('+', '')
  }

  const isOnCall = !!user.current_call_id

  // Duration timer for active calls
  const [activeCallDuration, setActiveCallDuration] = useState(0)

  useEffect(() => {
    if (!callStartTime) {
      setActiveCallDuration(0)
      return
    }

    const timer = setInterval(() => {
      const now = new Date()
      const elapsed = Math.floor((now.getTime() - callStartTime.getTime()) / 1000)
      setActiveCallDuration(elapsed)
    }, 1000)

    return () => clearInterval(timer)
  }, [callStartTime])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div
      ref={setNodeRef}
      className={`backdrop-blur-md bg-white/80 rounded-xl shadow-md p-4 border transition-all ${
        isOver && canAcceptCall
          ? 'border-blue-400 border-2 bg-blue-50/50 shadow-blue-200/50 shadow-xl'
          : 'border-white/20 shadow-slate-900/5'
      }`}
    >
      {/* Main horizontal layout */}
      <div className="flex items-center gap-4">
        {/* Avatar with status */}
        <div className="relative flex-shrink-0">
          <div className={`w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-md ${
            user.is_available && !activeCall && !user.current_call_id ? 'ring-2 ring-green-400 ring-offset-2' :
            (activeCall || user.current_call_id) ? 'ring-2 ring-blue-400 ring-offset-2 animate-pulse' :
            'ring-2 ring-slate-200 ring-offset-2'
          }`}>
            {getInitials(user.full_name)}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${getStatusColor()}`}></div>
        </div>

        {/* User info and status */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-sm text-slate-900 truncate">{user.full_name}</h3>
            {(activeCall || user.current_call_id) ? (
              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                On Call
              </span>
            ) : user.is_available ? (
              <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                Available
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                Offline
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="truncate">{user.email}</span>
            {isOnCall && !activeCall && user.current_call_phone_number && (
              <>
                <span>•</span>
                <span className="font-mono font-semibold text-blue-700">{formatPhoneNumber(user.current_call_phone_number)}</span>
              </>
            )}
          </div>
        </div>

        {/* Incoming Call - Inline compact card */}
        {incomingCall && !activeCall && (
          <div className="flex-shrink-0 backdrop-blur-md bg-gradient-to-br from-blue-50/90 to-indigo-50/90 border-2 border-blue-400 rounded-lg px-3 py-2 flex items-center gap-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <div>
                <div className="text-xs font-semibold text-blue-700 uppercase">Incoming</div>
                <div className="text-sm font-bold font-mono text-blue-900">{formatPhoneNumber(incomingCall.callerNumber)}</div>
              </div>
            </div>
            {onAnswerCall && onDeclineCall && (
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAnswerCall()
                  }}
                  className="bg-green-500 hover:bg-green-600 text-white p-1.5 rounded-md transition-all shadow-sm hover:shadow-md"
                  title="Answer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeclineCall()
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-md transition-all shadow-sm hover:shadow-md"
                  title="Decline"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Active Call - Inline compact card */}
        {(isOnCall || activeCall) && (activeCall || callStartTime) && callStartTime && (
          <div
            ref={activeCall ? setDragRef : undefined}
            {...(activeCall ? listeners : {})}
            {...(activeCall ? attributes : {})}
            className="flex-shrink-0 backdrop-blur-md bg-gradient-to-br from-blue-50/90 to-indigo-50/90 border-2 border-blue-400 rounded-lg px-3 py-2 flex items-center gap-2 cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-blue-700 uppercase">Active</span>
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full text-xs font-bold">
                    <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
                    {formatDuration(activeCallDuration)}
                  </span>
                </div>
                <div className="text-sm font-bold font-mono text-blue-900">{formatPhoneNumber(activeCall?.parameters?.From || user.current_call_phone_number || 'Unknown')}</div>
              </div>
            </div>
            {activeCall && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  activeCall.disconnect()
                }}
                className="ml-2 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-md transition-all shadow-sm hover:shadow-md"
                title="End Call"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Incoming Calls Count */}
          <div className="flex flex-col items-center" title={`${incomingCallsCount} incoming calls today`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center shadow-sm relative">
              <span className="text-white font-bold text-xs">IB</span>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm border border-green-200">
                <span className="text-[10px] font-bold text-green-700">{incomingCallsCount}</span>
              </div>
            </div>
          </div>

          {/* Outbound Calls Count */}
          <div className="flex flex-col items-center" title={`${outboundCallsCount} outbound calls today`}>
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center shadow-sm relative">
              <span className="text-white font-bold text-xs">OB</span>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm border border-orange-200">
                <span className="text-[10px] font-bold text-orange-700">{outboundCallsCount}</span>
              </div>
            </div>
          </div>

          {/* Call Icon Button */}
          <button
            onClick={() => onCall(user.id)}
            disabled={!user.is_available || isOnCall}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm ${
              user.is_available && !isOnCall
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white hover:shadow-md'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
            title={isOnCall ? 'On Call' : user.is_available ? 'Call Agent' : 'Unavailable'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>

          {/* Availability Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={user.is_available}
            disabled={isOnCall}
            onClick={() => onToggleAvailability(user.id, !user.is_available)}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-all shadow-sm
              ${user.is_available ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-slate-300'}
              ${isOnCall ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
            `}
            title={user.is_available ? 'Available' : 'Offline'}
          >
            <span
              className={`
                inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm
                ${user.is_available ? 'translate-x-6' : 'translate-x-0.5'}
              `}
            />
          </button>
        </div>
      </div>

      {/* Optimistic Transfer UI - Shows immediately while waiting for Twilio */}
      {optimisticTransfer && !incomingCall && !activeCall && (
        <div className="mt-3 p-3 bg-blue-50 border-2 border-blue-400 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center animate-pulse">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900">Transferring call...</p>
              <p className="text-lg font-bold text-blue-700">{optimisticTransfer.callerNumber}</p>
            </div>
            <div className="flex-shrink-0">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      )}



      {/* Drop zone indicator when dragging over */}
      {isOver && canAcceptCall && (
        <div className="mt-3 p-3 backdrop-blur-sm bg-blue-50/80 border-2 border-blue-400 border-dashed rounded-lg text-center">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-blue-700 font-bold text-sm">
              Drop to transfer
            </p>
          </div>
        </div>
      )}

      {/* Not available indicator when dragging over */}
      {isOver && !canAcceptCall && (
        <div className="mt-3 p-3 backdrop-blur-sm bg-red-50/80 border-2 border-red-300 border-dashed rounded-lg text-center">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <p className="text-red-700 font-bold text-sm">
              Not available
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

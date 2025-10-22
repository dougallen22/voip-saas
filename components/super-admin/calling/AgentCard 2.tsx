'use client'

import { useState, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import DraggableCallCard from './DraggableCallCard'
import MultiCallCard from './MultiCallCard'
import IncomingCallCard from './IncomingCallCard'
import TransferCallCard from './TransferCallCard'

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
  onTransfer?: (callSid: string, callerNumber: string) => void
  // Transfer mode props
  isTransferTarget?: boolean
  onClick?: () => void
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
  onTransfer,
  isTransferTarget,
  onClick
}: AgentCardProps) {
  const [callDuration, setCallDuration] = useState(0)

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

  useEffect(() => {
    if (activeCall && callStartTime) {
      const interval = setInterval(() => {
        const now = new Date()
        const diff = Math.floor((now.getTime() - callStartTime.getTime()) / 1000)
        setCallDuration(diff)
      }, 1000)

      return () => clearInterval(interval)
    } else {
      setCallDuration(0)
    }
  }, [activeCall, callStartTime])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

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

  const isOnCall = !!user.current_call_id

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`bg-white rounded-lg shadow-sm p-6 border transition-all ${
        isOver && canAcceptCall
          ? 'border-blue-500 border-2 bg-blue-50 shadow-lg scale-105'
          : isTransferTarget
          ? 'border-purple-500 border-2 bg-purple-50 shadow-lg cursor-pointer hover:scale-105'
          : 'border-slate-200'
      }`}
    >
      {/* Avatar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-semibold">
          {getInitials(user.full_name)}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900">{user.full_name}</h3>
          <p className="text-sm text-slate-600">{user.email}</p>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
        <span className="text-sm font-medium text-slate-700">{getStatusText()}</span>
      </div>

      {/* Transfer Target Indicator */}
      {isTransferTarget && (
        <div className="mb-4 p-3 bg-purple-100 border-2 border-purple-500 rounded-lg text-center animate-pulse">
          <p className="text-purple-700 font-semibold text-sm">
            Click to transfer call here
          </p>
        </div>
      )}

      {/* Optimistic Transfer UI - Shows immediately while waiting for Twilio */}
      {optimisticTransfer && !incomingCall && !activeCall && (
        <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-400 rounded-lg">
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

      {/* Multi-Agent Incoming Call - Visual Indicator Only (no buttons) */}
      {incomingCall && !activeCall && !onAnswerCall && (() => {
        console.log('🔴 RENDERING IncomingCallCard (NO BUTTONS)', {
          userEmail: user.email,
          callerNumber: incomingCall.callerNumber,
          hasOnAnswerCall: !!onAnswerCall,
          hasOnDeclineCall: !!onDeclineCall
        })
        return (
          <IncomingCallCard callerNumber={incomingCall.callerNumber} />
        )
      })()}

      {/* Transfer Call - With Answer/Decline Buttons (blue styling) */}
      {incomingCall && !activeCall && onAnswerCall && onDeclineCall && (() => {
        console.log('🟢 RENDERING TransferCallCard (WITH BUTTONS)', {
          userEmail: user.email,
          callerNumber: incomingCall.callerNumber,
          hasOnAnswerCall: !!onAnswerCall,
          hasOnDeclineCall: !!onDeclineCall
        })
        return (
          <TransferCallCard
            callerNumber={incomingCall.callerNumber}
            onAnswer={onAnswerCall}
            onDecline={onDeclineCall}
          />
        )
      })()}

      {/* Multi-Call Display - NEW */}
      {activeCalls.length > 0 && onHoldCall && onResumeCall && onEndCall && (
        <div className="mb-4 space-y-2">
          {activeCalls.map((callState) => (
            <MultiCallCard
              key={callState.callSid}
              callSid={callState.callSid}
              callerNumber={callState.call.parameters.From || 'Unknown'}
              startTime={callState.startTime}
              isOnHold={callState.isOnHold}
              isSelected={callState.callSid === selectedCallId}
              onHold={() => onHoldCall(callState.callSid)}
              onResume={() => onResumeCall(callState.callSid)}
              onEnd={() => onEndCall(callState.callSid)}
              onTransfer={
                onTransfer && callState.callSid === selectedCallId
                  ? () => onTransfer(callState.callSid, callState.call.parameters.From)
                  : undefined
              }
              callObject={callState.call}
              agentId={user.id}
              agentName={user.full_name}
            />
          ))}
        </div>
      )}

      {/* Legacy Single Call Display - Keep for backward compatibility */}
      {activeCalls.length === 0 && (isOnCall || activeCall) && activeCall && callStartTime && (
        <div className="mb-4">
          <DraggableCallCard
            id={`call-${user.id}`}
            callObject={activeCall}
            callerId={activeCall.parameters.From || 'Unknown'}
            callerName={undefined}
            duration={callDuration}
            agentId={user.id}
            agentName={user.full_name}
            onEndCall={() => activeCall.disconnect()}
            onTransfer={
              onTransfer
                ? () => onTransfer(activeCall.parameters.CallSid, activeCall.parameters.From)
                : undefined
            }
            isParked={false}
          />
        </div>
      )}

      {/* Drop zone indicator when dragging over */}
      {isOver && canAcceptCall && (
        <div className="mb-4 p-3 bg-blue-100 border-2 border-blue-500 border-dashed rounded-lg text-center">
          <p className="text-blue-700 font-semibold text-sm">
            Drop call here to transfer
          </p>
        </div>
      )}

      {/* Not available indicator when dragging over */}
      {isOver && !canAcceptCall && (
        <div className="mb-4 p-3 bg-red-100 border-2 border-red-300 border-dashed rounded-lg text-center">
          <p className="text-red-700 font-semibold text-sm">
            Agent not available
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {/* Availability Toggle */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium text-slate-700">Available</span>
          <button
            type="button"
            role="switch"
            aria-checked={user.is_available}
            disabled={isOnCall}
            onClick={() => onToggleAvailability(user.id, !user.is_available)}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${user.is_available ? 'bg-blue-600' : 'bg-gray-300'}
              ${isOnCall ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${user.is_available ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </label>

        {/* Call Button */}
        <button
          onClick={() => onCall(user.id)}
          disabled={!user.is_available || isOnCall}
          className={`
            w-full py-2 px-4 rounded-lg font-medium transition-colors
            ${user.is_available && !isOnCall
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isOnCall ? 'Busy' : user.is_available ? 'Call Agent' : 'Unavailable'}
        </button>
      </div>
    </div>
  )
}

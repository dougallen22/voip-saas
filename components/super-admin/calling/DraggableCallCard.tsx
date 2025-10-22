'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Call } from '@twilio/voice-sdk'

interface DraggableCallCardProps {
  id: string
  callObject: Call | null
  callerId: string
  callerName?: string
  duration: number
  agentId: string
  agentName: string
  onEndCall?: () => void
  onTransfer?: () => void
  onRemoveParked?: () => void
  isParked?: boolean
}

export default function DraggableCallCard({
  id,
  callObject,
  callerId,
  callerName,
  duration,
  agentId,
  agentName,
  onEndCall,
  onTransfer,
  onRemoveParked,
  isParked = false,
}: DraggableCallCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
    data: {
      type: 'call',
      callObject,
      callerId,
      callerName,
      agentId,
      agentName,
      isParked,
    },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

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
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`relative bg-gradient-to-r from-sky-400 to-blue-500 rounded-lg shadow-lg p-3 transition-all ${
        isDragging ? 'ring-2 ring-blue-500 shadow-2xl scale-105' : ''
      }`}
    >
      {/* Drag indicator */}
      <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-70">
        <div className="w-1 h-1 bg-white rounded-full"></div>
        <div className="w-1 h-1 bg-white rounded-full"></div>
        <div className="w-1 h-1 bg-white rounded-full"></div>
      </div>

      {/* Caller Info */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">📞</span>
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-base truncate">
            {callerName || formatPhoneNumber(callerId)}
          </div>
          {callerName && (
            <div className="text-sky-100 text-xs truncate">{formatPhoneNumber(callerId)}</div>
          )}
        </div>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-1.5 text-white text-xs mb-2">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
          {isParked ? 'On Hold' : 'Active'}
        </span>
        <span>•</span>
        <span className="font-mono font-bold">
          {formatDuration(duration)}
        </span>
      </div>

      {/* Agent info */}
      {!isParked && (
        <div className="text-sky-100 text-xs mb-3 truncate">
          With: {agentName}
        </div>
      )}
      {isParked && (
        <div className="text-sky-100 text-xs mb-3 truncate">
          Parked by: {agentName}
        </div>
      )}

      {/* Action buttons */}
      {!isDragging && !isParked && (
        <div className="flex gap-1.5 mb-2">
          {onTransfer && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTransfer()
              }}
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700 px-2 py-1 rounded text-xs font-semibold transition-colors"
            >
              Transfer
            </button>
          )}
          {onEndCall && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEndCall()
              }}
              className="flex-1 bg-white text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-semibold transition-colors"
            >
              End
            </button>
          )}
        </div>
      )}

      {/* Remove button for parked calls */}
      {!isDragging && isParked && onRemoveParked && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemoveParked()
          }}
          className="w-full bg-red-600 text-white hover:bg-red-700 px-2 py-1 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1 mb-2"
          title="Remove stuck call from parking lot"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Remove
        </button>
      )}

      {/* Drag instruction */}
      <div className="text-sky-100 text-xs text-center opacity-80 leading-tight">
        {isParked ? 'Drag to agent to retrieve' : 'Drag to parking lot to park'}
      </div>

      {/* Visual feedback when dragging */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 rounded-lg pointer-events-none"></div>
      )}
    </div>
  )
}

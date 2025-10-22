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
    // Handle negative or invalid durations
    const validSeconds = Math.max(0, Math.floor(seconds))
    const mins = Math.floor(validSeconds / 60)
    const secs = validSeconds % 60
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
      className={`relative backdrop-blur-md bg-white/80 rounded-lg shadow-md p-3 transition-all border ${
        isDragging
          ? 'border-blue-400 shadow-blue-200/50 shadow-xl scale-105'
          : isParked
          ? 'border-slate-200 shadow-slate-900/5'
          : 'border-blue-300 shadow-blue-900/5'
      }`}
    >
      {/* Drag indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-30">
        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
        <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
      </div>

      {/* Caller Info */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
          <span className="text-sm">📞</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-slate-900 font-bold text-sm font-mono truncate">
            {callerName || formatPhoneNumber(callerId)}
          </div>
          {callerName && (
            <div className="text-slate-500 text-xs font-mono truncate">{formatPhoneNumber(callerId)}</div>
          )}
        </div>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-1.5 mb-2">
        {isParked ? (
          <div className="flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-full border border-amber-200 flex-1">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
            <span className="text-xs font-semibold text-amber-700">On Hold</span>
            <span className="text-xs text-amber-600">•</span>
            <span className="font-mono font-bold text-xs text-amber-700">{formatDuration(duration)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-green-50 px-2 py-1 rounded-full border border-green-200 flex-1">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-xs font-semibold text-green-700">Active</span>
            <span className="text-xs text-green-600">•</span>
            <span className="font-mono font-bold text-xs text-green-700">{formatDuration(duration)}</span>
          </div>
        )}
      </div>

      {/* Agent info */}
      {!isParked && (
        <div className="text-slate-500 text-xs mb-2 truncate">
          With: {agentName}
        </div>
      )}
      {isParked && (
        <div className="text-slate-500 text-xs mb-2 truncate">
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
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-md text-xs font-semibold transition-all shadow-sm"
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
              className="flex-1 bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-md text-xs font-semibold transition-all shadow-sm"
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
          className="w-full bg-red-500 hover:bg-red-600 text-white px-2 py-1.5 rounded-md text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-1.5 mb-2"
          title="Remove stuck call from parking lot"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Remove
        </button>
      )}

      {/* Drag instruction */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          <span>{isParked ? 'Drag to retrieve' : 'Drag to park'}</span>
        </div>
      </div>

      {/* Visual feedback when dragging */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-400 bg-opacity-10 rounded-lg pointer-events-none backdrop-blur-sm"></div>
      )}
    </div>
  )
}

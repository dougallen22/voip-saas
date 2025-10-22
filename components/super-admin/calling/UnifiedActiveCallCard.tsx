'use client'

import { useState, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

interface UnifiedActiveCallCardProps {
  // Data (works for both local and remote)
  callerId: string
  callerName?: string
  answeredAt: Date | null

  // User context
  isCurrentUser: boolean
  agentId: string
  agentName: string

  // Interaction (only for current user)
  onEndCall?: () => void

  // Dragging (only for current user)
  callObject?: any
  enableDrag?: boolean
}

export default function UnifiedActiveCallCard({
  callerId,
  callerName,
  answeredAt,
  isCurrentUser,
  agentId,
  agentName,
  onEndCall,
  callObject,
  enableDrag = false
}: UnifiedActiveCallCardProps) {
  const [duration, setDuration] = useState(0)

  // Drag functionality (only enabled for current user)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `call-${agentId}`,
    data: {
      type: 'call',
      callObject,
      callerId,
      callerName,
      agentId,
      agentName,
      isParked: false,
    },
    disabled: !enableDrag || !isCurrentUser
  })

  const style = enableDrag && isCurrentUser ? {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  } : {}

  // Duration timer (works for both local and remote)
  useEffect(() => {
    if (!answeredAt) return

    const timer = setInterval(() => {
      const now = new Date()
      const elapsed = Math.floor((now.getTime() - answeredAt.getTime()) / 1000)
      setDuration(elapsed)
    }, 1000)

    return () => clearInterval(timer)
  }, [answeredAt])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
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

  return (
    <div
      ref={enableDrag && isCurrentUser ? setNodeRef : undefined}
      style={style}
      {...(enableDrag && isCurrentUser ? listeners : {})}
      {...(enableDrag && isCurrentUser ? attributes : {})}
      className={`relative bg-gradient-to-r from-sky-400 to-blue-500 rounded-lg shadow-lg p-4 transition-all ${
        isDragging ? 'ring-2 ring-blue-500 shadow-2xl scale-105' : ''
      }`}
    >
      {/* Drag indicator (only for current user) */}
      {enableDrag && isCurrentUser && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-70">
          <div className="w-1 h-1 bg-white rounded-full"></div>
          <div className="w-1 h-1 bg-white rounded-full"></div>
          <div className="w-1 h-1 bg-white rounded-full"></div>
        </div>
      )}

      {/* Remote user indicator (only for other users) */}
      {!isCurrentUser && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-white/20 rounded text-xs text-white font-semibold">
          Remote
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Caller Info */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📞</span>
            <div>
              <div className="text-white font-bold text-lg">
                {callerName || formatPhoneNumber(callerId)}
              </div>
              {callerName && (
                <div className="text-sky-100 text-sm">{formatPhoneNumber(callerId)}</div>
              )}
            </div>
          </div>

          {/* Status indicator with duration */}
          <div className="flex items-center gap-2 text-white text-sm mb-2">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              Active Call
            </span>
            <span>•</span>
            <span className="font-mono font-bold">
              {formatDuration(duration)}
            </span>
          </div>

          {/* Agent info */}
          <div className="text-sky-100 text-xs">
            {isCurrentUser ? 'Your active call' : `On call with ${agentName}`}
          </div>
        </div>

        {/* Action buttons (only for current user) */}
        {isCurrentUser && !isDragging && onEndCall && (
          <div className="flex flex-col gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEndCall()
              }}
              className="bg-white text-red-600 hover:bg-red-50 px-3 py-1 rounded-md text-sm font-semibold transition-colors"
            >
              End Call
            </button>
          </div>
        )}
      </div>

      {/* Drag instruction (only for current user) */}
      {enableDrag && isCurrentUser && (
        <div className="mt-3 text-sky-100 text-xs text-center opacity-80 leading-relaxed">
          Drag to parking lot to park
        </div>
      )}

      {/* Visual feedback when dragging */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 rounded-lg pointer-events-none"></div>
      )}
    </div>
  )
}

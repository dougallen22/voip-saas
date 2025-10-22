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
      className={`relative backdrop-blur-lg bg-white/90 rounded-xl shadow-lg p-4 transition-all border-2 ${
        isDragging
          ? 'border-blue-400 shadow-blue-200/50 shadow-2xl scale-105'
          : 'border-blue-500 shadow-blue-900/5'
      }`}
    >
      {/* Drag indicator (only for current user) */}
      {enableDrag && isCurrentUser && (
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-40">
          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
          <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
        </div>
      )}

      {/* Remote user indicator (only for other users) */}
      {!isCurrentUser && (
        <div className="absolute top-3 right-3 px-2 py-0.5 bg-slate-100 rounded-full text-xs text-slate-600 font-medium border border-slate-200">
          Remote
        </div>
      )}

      {/* Compact horizontal layout */}
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md flex-shrink-0">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>

        {/* Call info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{isCurrentUser ? 'Active Call' : 'On Call'}</span>
            <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              {formatDuration(duration)}
            </span>
          </div>
          <div className="text-lg font-bold font-mono text-blue-900 break-all leading-tight">
            {formatPhoneNumber(callerId)}
          </div>
        </div>

        {/* Action button (only for current user) */}
        {isCurrentUser && !isDragging && onEndCall && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEndCall()
            }}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow-md flex items-center gap-2 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            End
          </button>
        )}
      </div>

      {/* Drag instruction (only for current user) */}
      {enableDrag && isCurrentUser && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            <span>Drag to park</span>
          </div>
        </div>
      )}

      {/* Visual feedback when dragging */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-400 bg-opacity-10 rounded-xl pointer-events-none backdrop-blur-sm"></div>
      )}
    </div>
  )
}

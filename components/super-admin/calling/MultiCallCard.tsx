'use client'

import { useState, useEffect } from 'react'
import { useDraggable } from '@dnd-kit/core'

interface MultiCallCardProps {
  callSid: string
  callerNumber: string
  startTime: Date
  isOnHold: boolean
  isSelected: boolean
  onHold: () => void
  onResume: () => void
  onEnd: () => void
  onTransfer?: () => void
  callObject: any
  agentId: string
  agentName: string
}

export default function MultiCallCard({
  callSid,
  callerNumber,
  startTime,
  isOnHold,
  isSelected,
  onHold,
  onResume,
  onEnd,
  onTransfer,
  callObject,
  agentId,
  agentName
}: MultiCallCardProps) {
  const [duration, setDuration] = useState(0)

  // Make card draggable
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `multicall-${callSid}`,
    data: {
      type: 'call',
      callObject,
      callerId: callerNumber,
      agentId,
      agentName,
      callSid,
      isParked: false,
    },
  })

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000)
      setDuration(diff)
    }, 1000)

    return () => clearInterval(interval)
  }, [startTime])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-3 rounded-lg border-2 mb-2 transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${
        isSelected
          ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-500'
          : isOnHold
          ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-400 border-dashed'
          : 'bg-white border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isOnHold ? (
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          )}
          <div>
            <p className={`text-sm font-semibold ${isSelected ? 'text-green-900' : isOnHold ? 'text-yellow-900' : 'text-slate-900'}`}>
              {callerNumber}
            </p>
            <p className={`text-xs ${isSelected ? 'text-green-700' : isOnHold ? 'text-yellow-700' : 'text-slate-600'}`}>
              {formatDuration(duration)}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          {/* Transfer button - only show for selected (active) call */}
          {isSelected && onTransfer && (
            <button
              onClick={onTransfer}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors"
              title="Transfer call"
            >
              Transfer
            </button>
          )}
          {/* Hold/Resume buttons */}
          {isOnHold ? (
            <button
              onClick={onResume}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded transition-colors"
              title="Resume call"
            >
              Resume
            </button>
          ) : isSelected && (
            <button
              onClick={onHold}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-semibold rounded transition-colors"
              title="Hold call"
            >
              Hold
            </button>
          )}
          {/* End button */}
          <button
            onClick={onEnd}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded transition-colors"
            title="End call"
          >
            End
          </button>
        </div>
      </div>
      {isSelected && (
        <div className="flex items-center gap-1">
          <div className="h-1 w-1 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-green-700 font-medium">Active</span>
        </div>
      )}
      {isOnHold && (
        <div className="flex items-center gap-1">
          <div className="h-1 w-1 bg-yellow-500 rounded-full"></div>
          <span className="text-xs text-yellow-700 font-medium">On Hold</span>
        </div>
      )}
    </div>
  )
}

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`relative bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-4 transition-all ${
        isDragging ? 'ring-2 ring-blue-500 shadow-2xl scale-105' : ''
      }`}
    >
      {/* Drag indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-70">
        <div className="w-1 h-1 bg-white rounded-full"></div>
        <div className="w-1 h-1 bg-white rounded-full"></div>
        <div className="w-1 h-1 bg-white rounded-full"></div>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Caller Info */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">📞</span>
            <div>
              <div className="text-white font-bold text-lg">
                {callerName || callerId}
              </div>
              {callerName && (
                <div className="text-green-100 text-sm">{callerId}</div>
              )}
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 text-white text-sm">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              {isParked ? 'On Hold' : 'Active Call'}
            </span>
            <span>•</span>
            <span className="font-mono font-bold">
              {formatDuration(duration)}
            </span>
          </div>

          {/* Agent info */}
          {!isParked && (
            <div className="text-green-100 text-xs mt-1">
              With: {agentName}
            </div>
          )}
          {isParked && (
            <div className="text-green-100 text-xs mt-1">
              Parked by: {agentName}
            </div>
          )}
        </div>

        {/* Action buttons - only show when not dragging and not parked */}
        {!isDragging && !isParked && (
          <div className="flex flex-col gap-2">
            {onTransfer && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onTransfer()
                }}
                className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1 rounded-md text-sm font-semibold transition-colors"
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
                className="bg-white text-red-600 hover:bg-red-50 px-3 py-1 rounded-md text-sm font-semibold transition-colors"
              >
                End Call
              </button>
            )}
          </div>
        )}
      </div>

      {/* Drag instruction */}
      <div className="mt-2 text-green-100 text-xs text-center opacity-80">
        {isParked ? 'Drag to agent to retrieve' : 'Drag to parking lot to park'}
      </div>

      {/* Visual feedback when dragging */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 rounded-lg pointer-events-none"></div>
      )}
    </div>
  )
}

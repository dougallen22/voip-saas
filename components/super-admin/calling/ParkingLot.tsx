'use client'

import { useEffect, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useCallParkingStore } from '@/lib/stores/callParkingStore'
import type { ParkedCall } from '@/lib/stores/callParkingStore'
import DraggableCallCard from './DraggableCallCard'

interface ParkingLotProps {
  onUnpark?: (parkedCallId: string, newAgentId: string) => void
}

export default function ParkingLot({ onUnpark }: ParkingLotProps) {
  const parkedCalls = useCallParkingStore((state) => state.parkedCalls)
  const removeParkedCall = useCallParkingStore((state) => state.removeParkedCall)
  const [parkDurations, setParkDurations] = useState<Map<string, number>>(new Map())

  const { setNodeRef, isOver } = useDroppable({
    id: 'parking-lot',
    data: { accepts: ['call'] },
  })

  // Update park durations every second
  useEffect(() => {
    // Calculate durations immediately on mount/change
    const calculateDurations = () => {
      const newDurations = new Map<string, number>()
      parkedCalls.forEach((call, id) => {
        const duration = Math.floor((Date.now() - call.parkedAt.getTime()) / 1000)
        newDurations.set(id, duration)
      })
      setParkDurations(newDurations)
    }

    // Calculate immediately
    calculateDurations()

    // Then update every second
    const interval = setInterval(calculateDurations, 1000)

    return () => clearInterval(interval)
  }, [parkedCalls])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleRemoveParkedCall = async (parkedCallId: string) => {
    if (!confirm('Remove this call from the parking lot? The caller will be disconnected.')) {
      return
    }

    try {
      console.log('🗑️ Removing parked call from database:', parkedCallId)

      const response = await fetch('/api/admin/cleanup-parked-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_one',
          parkedCallId: parkedCallId
        })
      })

      const result = await response.json()

      if (result.success) {
        console.log('✅ Parked call removed from database')
        // The DELETE event subscription will remove it from Zustand
      } else {
        console.error('Failed to remove parked call:', result.error)
        alert('Failed to remove call: ' + result.error)
      }
    } catch (error) {
      console.error('Error removing parked call:', error)
      alert('Failed to remove call')
    }
  }

  const parkedCallsArray = Array.from(parkedCalls.values())

  return (
    <div
      ref={setNodeRef}
      className={`fixed left-4 right-4 bottom-4 h-64 lg:top-32 lg:left-auto lg:right-4 lg:bottom-4 lg:w-56 lg:h-auto backdrop-blur-lg bg-white/70 rounded-2xl shadow-xl border transition-all z-20 ${
        isOver ? 'border-blue-400 bg-blue-50/50 shadow-blue-200/50 shadow-2xl' : 'border-white/20 shadow-slate-900/5'
      }`}
    >
      {/* Header - Modern Glass */}
      <div className="bg-gradient-to-br from-slate-50/80 to-white/60 backdrop-blur-sm p-4 rounded-t-2xl border-b border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <h3 className="font-semibold text-sm text-slate-700">Parked</h3>
          </div>
          {parkedCallsArray.length > 0 && (
            <span className="bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">
              {parkedCallsArray.length}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-2 leading-tight">
          Drag calls here to park
        </p>
      </div>

      {/* Parked Calls List */}
      <div className="overflow-y-auto p-3 space-y-3 h-[calc(100%-120px)] lg:h-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
        {parkedCallsArray.length === 0 ? (
          <div className="py-6 lg:py-12 text-center">
            <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-2 lg:mb-3 shadow-sm">
              <span className="text-2xl lg:text-3xl font-bold text-slate-400">P</span>
            </div>
            <p className="text-xs text-slate-400 font-medium">No parked calls</p>
            <p className="text-xs text-slate-300 mt-1">Drag active calls here</p>
          </div>
        ) : (
          <>
            {parkedCallsArray.map((call) => (
              <DraggableCallCard
                key={call.id}
                id={`parked-${call.id}`}
                callObject={call.callObject}
                callerId={call.callerId}
                callerName={call.callerName}
                duration={parkDurations.get(call.id) || 0}
                agentId={call.parkedBy}
                agentName={call.parkedByName || 'Unknown'}
                isParked={true}
                onRemoveParked={() => handleRemoveParkedCall(call.id)}
              />
            ))}
          </>
        )}
      </div>

      {/* Drop zone indicator when dragging over */}
      {isOver && (
        <div className="absolute inset-0 backdrop-blur-sm bg-blue-500/10 rounded-2xl flex items-center justify-center pointer-events-none border-2 border-blue-400 border-dashed">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white px-4 py-3 rounded-xl font-semibold shadow-2xl text-sm text-center backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span>Drop to park</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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
    const interval = setInterval(() => {
      const newDurations = new Map<string, number>()
      parkedCalls.forEach((call, id) => {
        const duration = Math.floor((Date.now() - call.parkedAt.getTime()) / 1000)
        newDurations.set(id, duration)
      })
      setParkDurations(newDurations)
    }, 1000)

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
      className={`fixed top-24 right-4 bottom-4 w-48 bg-white rounded-lg shadow-2xl border-2 transition-all ${
        isOver ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
      }`}
    >
      {/* Header - Compact */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white p-3 rounded-t-lg">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚗</span>
            <span className="bg-white text-slate-800 px-2 py-0.5 rounded-full text-xs font-semibold">
              {parkedCallsArray.length}
            </span>
          </div>
          <h3 className="font-bold text-sm text-center">Parking Lot</h3>
        </div>
        <p className="text-xs text-slate-300 mt-2 text-center leading-tight">
          Drop calls here
        </p>
      </div>

      {/* Parked Calls List */}
      <div className="overflow-y-auto p-2 space-y-2" style={{ maxHeight: 'calc(100vh - 160px)' }}>
        {parkedCallsArray.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <div className="text-3xl mb-1">🅿️</div>
            <p className="text-xs px-2">No parked calls</p>
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
        <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded-lg flex items-center justify-center pointer-events-none">
          <div className="bg-blue-500 text-white px-3 py-2 rounded-lg font-semibold shadow-lg text-xs text-center">
            Drop to park
          </div>
        </div>
      )}
    </div>
  )
}

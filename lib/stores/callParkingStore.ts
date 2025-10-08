import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Call } from '@twilio/voice-sdk'

export interface ParkedCall {
  id: string
  callObject: Call | null
  callerId: string
  callerName?: string
  parkedAt: Date
  parkedBy: string
  parkedByName?: string
  conferenceSid: string | null
  participantSid: string | null
  holdMusicUrl: string
  originalAgentId?: string
}

interface CallParkingState {
  parkedCalls: Map<string, ParkedCall>

  // Actions
  addParkedCall: (call: ParkedCall) => void
  removeParkedCall: (callId: string) => void
  updateParkedCall: (callId: string, updates: Partial<ParkedCall>) => void
  getParkedCall: (callId: string) => ParkedCall | undefined
  clearAllParkedCalls: () => void

  // Sync from database
  addParkedCallFromDb: (dbRecord: any) => void
}

export const useCallParkingStore = create<CallParkingState>()(
  devtools(
    (set, get) => ({
      parkedCalls: new Map(),

      addParkedCall: (call) =>
        set((state) => {
          const newMap = new Map(state.parkedCalls)
          newMap.set(call.id, call)
          console.log('🚗 Call parked:', call.id, 'Total parked:', newMap.size)
          return { parkedCalls: newMap }
        }),

      removeParkedCall: (callId) =>
        set((state) => {
          const newMap = new Map(state.parkedCalls)
          const deleted = newMap.delete(callId)
          if (deleted) {
            console.log('🎯 Call retrieved from parking:', callId, 'Remaining:', newMap.size)
          }
          return { parkedCalls: newMap }
        }),

      updateParkedCall: (callId, updates) =>
        set((state) => {
          const newMap = new Map(state.parkedCalls)
          const existing = newMap.get(callId)
          if (existing) {
            newMap.set(callId, { ...existing, ...updates })
            console.log('🔄 Parked call updated:', callId)
          }
          return { parkedCalls: newMap }
        }),

      getParkedCall: (callId) => {
        return get().parkedCalls.get(callId)
      },

      clearAllParkedCalls: () =>
        set(() => {
          console.log('🧹 Clearing all parked calls')
          return { parkedCalls: new Map() }
        }),

      addParkedCallFromDb: (dbRecord) =>
        set((state) => {
          const newMap = new Map(state.parkedCalls)
          const parkedCall: ParkedCall = {
            id: dbRecord.id,
            callObject: null, // Can't reconstruct Call object from DB
            callerId: dbRecord.caller_number,
            callerName: dbRecord.metadata?.caller_name,
            parkedAt: new Date(dbRecord.parked_at),
            parkedBy: dbRecord.parked_by_user_id,
            parkedByName: dbRecord.metadata?.parked_by_name,
            conferenceSid: dbRecord.twilio_conference_sid,
            participantSid: dbRecord.twilio_participant_sid,
            holdMusicUrl: dbRecord.metadata?.hold_music_url || '',
            originalAgentId: dbRecord.original_agent_id,
          }
          newMap.set(parkedCall.id, parkedCall)
          return { parkedCalls: newMap }
        }),
    }),
    { name: 'CallParkingStore' }
  )
)

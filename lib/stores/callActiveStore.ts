import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface ActiveCall {
  callId: string
  callSid?: string
  callerNumber: string | null
  answeredAt: Date | null
}

interface HydrateInput {
  userId: string
  currentCallId?: string | null
  currentCallPhoneNumber?: string | null
  currentCallAnsweredAt?: string | null
}

interface VoipUserRow {
  id: string
  current_call_id?: string | null
  current_call_phone_number?: string | null
}

interface CallRow {
  id: string
  status?: string | null
  assigned_to?: string | null
  from_number?: string | null
  answered_at?: string | null
  twilio_call_sid?: string | null
}

interface ActiveCallRow {
  call_sid: string
  agent_id?: string | null
  caller_number?: string | null
  status?: string | null
}

interface CallActiveState {
  activeCalls: Map<string, ActiveCall>
  hydrateFromUsers: (users: HydrateInput[]) => void
  upsertFromVoipUser: (row: VoipUserRow) => void
  removeForUser: (userId: string) => void
  syncFromCallRow: (call: CallRow) => void
  upsertFromActiveCallRow: (row: ActiveCallRow) => void
  removeByCallSid: (callSid: string) => void
  clearAll: () => void
}

const shouldRemoveStatus = new Set([
  'completed',
  'completed_no_answer',
  'ended',
  'failed',
  'busy',
  'canceled',
  'parked',
])

const toDate = (value?: string | null) => (value ? new Date(value) : null)

export const useCallActiveStore = create<CallActiveState>()(
  devtools(
    (set) => ({
      activeCalls: new Map(),

      hydrateFromUsers: (users) =>
        set(() => {
          const next = new Map<string, ActiveCall>()
          users.forEach((user) => {
            if (user.currentCallId) {
              next.set(user.userId, {
                callId: user.currentCallId,
                callerNumber: user.currentCallPhoneNumber ?? null,
                answeredAt: toDate(user.currentCallAnsweredAt),
              })
            }
          })
          return { activeCalls: next }
        }),

      upsertFromVoipUser: (row) =>
        set((state) => {
          const next = new Map(state.activeCalls)
          if (row.current_call_id) {
            const existing = next.get(row.id)
            next.set(row.id, {
              callId: row.current_call_id,
              callerNumber:
                row.current_call_phone_number ??
                existing?.callerNumber ??
                null,
              answeredAt: existing?.answeredAt ?? null,
            })
          } else {
            next.delete(row.id)
          }
          return { activeCalls: next }
        }),

      removeForUser: (userId) =>
        set((state) => {
          const next = new Map(state.activeCalls)
          next.delete(userId)
          return { activeCalls: next }
        }),

      syncFromCallRow: (call) =>
        set((state) => {
          const next = new Map(state.activeCalls)

          if (!call.assigned_to) {
            if (call.status && shouldRemoveStatus.has(call.status)) {
              Array.from(next.entries()).forEach(([userId, activeCall]) => {
                if (activeCall.callId === call.id) {
                  next.delete(userId)
                }
              })
              return { activeCalls: next }
            }
            return state
          }

          if (call.status && shouldRemoveStatus.has(call.status)) {
            next.delete(call.assigned_to)
            return { activeCalls: next }
          }

          const existing = next.get(call.assigned_to)
          next.set(call.assigned_to, {
            callId: call.id,
            callSid: call.twilio_call_sid ?? existing?.callSid ?? existing?.callId,
            callerNumber:
              call.from_number ??
              existing?.callerNumber ??
              null,
            answeredAt: call.answered_at
              ? new Date(call.answered_at)
              : existing?.answeredAt ?? null,
          })
          return { activeCalls: next }
        }),

      upsertFromActiveCallRow: (row) =>
        set((state) => {
          if (!row.agent_id) return state

          const next = new Map(state.activeCalls)
          const existing = next.get(row.agent_id)

          if (row.status && shouldRemoveStatus.has(row.status)) {
            next.delete(row.agent_id)
            return { activeCalls: next }
          }

          if (row.status !== 'active') {
            return state
          }

          next.set(row.agent_id, {
            callId: existing?.callId ?? row.call_sid,
            callSid: row.call_sid,
            callerNumber:
              row.caller_number ??
              existing?.callerNumber ??
              null,
            answeredAt: existing?.answeredAt ?? null,
          })

          return { activeCalls: next }
        }),

      removeByCallSid: (callSid) =>
        set((state) => {
          const next = new Map(state.activeCalls)
          Array.from(next.entries()).forEach(([userId, call]) => {
            if (call.callSid === callSid || call.callId === callSid) {
              next.delete(userId)
            }
          })
          return { activeCalls: next }
        }),

      clearAll: () => ({ activeCalls: new Map() }),
    }),
    { name: 'CallActiveStore' }
  )
)

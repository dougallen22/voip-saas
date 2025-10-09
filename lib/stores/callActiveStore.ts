import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface ActiveCall {
  callId: string
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
}

interface CallActiveState {
  activeCalls: Map<string, ActiveCall>
  hydrateFromUsers: (users: HydrateInput[]) => void
  upsertFromVoipUser: (row: VoipUserRow) => void
  removeForUser: (userId: string) => void
  syncFromCallRow: (call: CallRow) => void
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

      clearAll: () => ({ activeCalls: new Map() }),
    }),
    { name: 'CallActiveStore' }
  )
)

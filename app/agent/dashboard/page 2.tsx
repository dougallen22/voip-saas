'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import IncomingCallAlert from '@/components/agent/IncomingCallAlert'
import ActiveCallPanel from '@/components/agent/ActiveCallPanel'

export default function AgentDashboard() {
  const [user, setUser] = useState<any>(null)
  const [isAvailable, setIsAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [incomingCall, setIncomingCall] = useState<any>(null)
  const [activeCall, setActiveCall] = useState<any>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      router.push('/login')
      return
    }

    // Get agent details
    const response = await fetch(`/api/saas-users/list`)
    const data = await response.json()
    const agentData = data.users?.find((u: any) => u.id === authUser.id)

    if (!agentData) {
      router.push('/login')
      return
    }

    setUser(agentData)
    setIsAvailable(agentData.is_available)
    setIsLoading(false)

    // Subscribe to real-time changes
    const channel = supabase
      .channel('agent-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'voip_users',
          filter: `id=eq.${authUser.id}`,
        },
        (payload: any) => {
          setIsAvailable(payload.new.is_available)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const toggleAvailability = async () => {
    if (!user) return

    const newStatus = !isAvailable

    try {
      await fetch('/api/saas-users/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          is_available: newStatus,
        }),
      })

      setIsAvailable(newStatus)
    } catch (error) {
      console.error('Error toggling availability:', error)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Agent Dashboard</h1>
              <p className="text-sm text-slate-600">{user?.full_name}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="text-sm text-slate-600 hover:text-slate-900 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Availability Toggle Card */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Availability Status</h2>
              <p className="text-slate-600">
                {isAvailable
                  ? 'You are available to receive calls'
                  : 'You are currently offline'}
              </p>
            </div>
            <button
              onClick={toggleAvailability}
              className={`
                relative inline-flex h-16 w-32 items-center rounded-full transition-colors
                ${isAvailable ? 'bg-green-600' : 'bg-gray-300'}
              `}
            >
              <span
                className={`
                  inline-block h-12 w-12 transform rounded-full bg-white transition-transform shadow-lg
                  ${isAvailable ? 'translate-x-[72px]' : 'translate-x-2'}
                `}
              />
              <span
                className={`
                  absolute text-sm font-medium
                  ${isAvailable ? 'left-4 text-white' : 'right-4 text-slate-600'}
                `}
              >
                {isAvailable ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>

        {/* Status Display */}
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
            isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            <div className={`w-3 h-3 rounded-full ${
              isAvailable ? 'bg-green-500' : 'bg-gray-400'
            }`}></div>
            <span className="font-medium">
              {isAvailable ? 'Ready to receive calls' : 'Offline - Not receiving calls'}
            </span>
          </div>

          {isAvailable && (
            <p className="mt-4 text-slate-600">
              Waiting for incoming calls...
            </p>
          )}
        </div>

        {/* Call History Placeholder */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Calls</h3>
          <p className="text-slate-600 text-center py-8">
            No calls yet. Call history will appear here.
          </p>
        </div>
      </main>
    </div>
  )
}

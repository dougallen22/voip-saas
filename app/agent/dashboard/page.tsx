'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function AgentDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

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
      router.push('/dashboard')
      return
    }

    setUser(agentData)
    setIsLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
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
              <p className="text-sm text-slate-600">Welcome back, {user?.full_name || user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Calling Dashboard Card */}
          <Link href="/super-admin/calling">
            <div className="bg-white p-6 rounded-lg border border-slate-200 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Calling Dashboard</h3>
                  <p className="text-sm text-slate-600">Manage calls and agents</p>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Answer calls, view team status, and manage call parking
              </p>
            </div>
          </Link>

          {/* Status Card */}
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Your Status</h3>
                <p className="text-sm text-slate-600">
                  {user?.is_available ? 'Available' : 'Unavailable'}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Role: {user?.role === 'super_admin' ? 'Super Admin' : 'Agent'}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

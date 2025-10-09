'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// DEPRECATED: This dashboard is no longer used.
// All agents and super_admins now use the UNIFIED calling dashboard at /super-admin/calling
// This ensures ALL users see the SAME view from the database.

export default function AgentDashboard() {
  const router = useRouter()

  useEffect(() => {
    // Immediately redirect to unified calling dashboard
    console.log('🔄 REDIRECT: Agent dashboard deprecated - redirecting to unified calling dashboard')
    router.replace('/super-admin/calling')
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to unified calling dashboard...</p>
      </div>
    </div>
  )
}

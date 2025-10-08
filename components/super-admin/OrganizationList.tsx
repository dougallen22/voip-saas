'use client'

import Link from 'next/link'

interface Organization {
  id: string
  name: string
  twilio_number: string | null
  created_at: string
  voip_users?: Array<{ count: number }>
}

export default function OrganizationList({ organizations }: { organizations: Organization[] }) {
  if (organizations.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>No organizations yet. Create your first one to get started.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-200">
      {organizations.map((org) => (
        <div key={org.id} className="p-6 hover:bg-slate-50 transition-colors">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">{org.name}</h3>
              <div className="flex gap-4 text-sm text-slate-600">
                <span>
                  {org.voip_users?.[0]?.count || 0} {org.voip_users?.[0]?.count === 1 ? 'user' : 'users'}
                </span>
                {org.twilio_number && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {org.twilio_number}
                  </span>
                )}
                <span className="text-slate-400">
                  Created {new Date(org.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/super-admin/organizations/${org.id}`}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Manage
              </Link>
              <Link
                href={`/dashboard?org=${org.id}`}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                View Dashboard
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

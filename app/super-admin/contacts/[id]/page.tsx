'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navigation from '@/components/super-admin/Navigation'
import ContactFormModal from '@/components/super-admin/contacts/ContactFormModal'
import { useTwilioDevice } from '@/hooks/useTwilioDevice'
import IncomingCallCard from '@/components/super-admin/calling/IncomingCallCard'

interface Contact {
  id: string
  organization_id: string | null
  business_name: string | null
  first_name: string
  last_name: string
  phone: string
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  created_at: string
  updated_at: string
}

interface Call {
  id: string
  from_number: string
  to_number: string
  status: string
  duration: number | null
  started_at: string
  answered_at: string | null
  ended_at: string | null
  created_at: string
}

export default function ContactDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)
  const [callHistory, setCallHistory] = useState<Call[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  // Twilio device for incoming calls and click-to-call
  const {
    incomingCall,
    acceptCall,
    rejectCall,
    device,
    makeOutboundCall,
    outboundCall,
    outboundCallStatus
  } = useTwilioDevice()

  // Fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: voipUser } = await supabase
          .from('voip_users')
          .select('role')
          .eq('id', user.id)
          .single()

        if (voipUser) {
          setCurrentUserRole(voipUser.role)
        }
      }
    }
    fetchUserRole()
  }, [supabase])

  // Fetch contact and call history
  useEffect(() => {
    const fetchContact = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/contacts/${params.id}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to load contact')
          return
        }

        setContact(data.contact)
        setCallHistory(data.callHistory || [])
      } catch (err: any) {
        console.error('Error fetching contact:', err)
        setError('An error occurred while loading the contact')
      } finally {
        setIsLoading(false)
      }
    }

    fetchContact()
  }, [params.id])

  const handleDelete = async () => {
    if (!contact) return

    const fullName = `${contact.first_name} ${contact.last_name}`
    if (!confirm(`Are you sure you want to delete ${fullName}?`)) {
      return
    }

    try {
      const response = await fetch('/api/contacts/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contact.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to delete contact')
        return
      }

      // Navigate back to contacts list
      router.push('/super-admin/contacts')
    } catch (error) {
      console.error('Error deleting contact:', error)
      alert('An error occurred while deleting the contact')
    }
  }

  const handleCall = async () => {
    if (!contact) {
      alert('Contact information not loaded. Please refresh the page.')
      return
    }

    try {
      const fullName = `${contact.first_name} ${contact.last_name}`
      console.log('Initiating call to:', fullName, contact.phone)
      await makeOutboundCall(contact.phone, fullName)
      // Show success feedback (optional - the UI will update via outboundCallStatus)
      console.log('Call initiated successfully')
    } catch (error: any) {
      console.error('Error initiating call:', error)
      alert(error.message || 'Failed to initiate call. Please try again.')
    }
  }

  const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 11 && digits[0] === '1') {
      const number = digits.slice(1)
      return `${number.slice(0, 3)}-${number.slice(3, 6)}-${number.slice(6)}`
    } else if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    }
    return phone
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Navigation userRole={currentUserRole || undefined} />
        <div className="container mx-auto px-4 sm:px-6 py-12 text-center">
          <div className="text-lg text-slate-600">Loading contact...</div>
        </div>
      </div>
    )
  }

  if (error || !contact) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Navigation userRole={currentUserRole || undefined} />
        <div className="container mx-auto px-4 sm:px-6 py-12 text-center">
          <div className="text-lg text-red-600 mb-4">{error || 'Contact not found'}</div>
          <button
            onClick={() => router.push('/super-admin/contacts')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Contacts
          </button>
        </div>
      </div>
    )
  }

  const fullName = `${contact.first_name} ${contact.last_name}`
  const displayName = contact.business_name || fullName

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Navigation Menu */}
      <Navigation userRole={currentUserRole || undefined} />

      {/* Incoming Call Banner */}
      {incomingCall && (
        <div className="sticky top-16 z-30 backdrop-blur-sm bg-white/50 border-b border-orange-200">
          <div className="container mx-auto px-4 sm:px-6 py-4">
            <IncomingCallCard callerNumber={incomingCall.parameters.From} />
            <div className="flex gap-3 mt-3">
              <button
                onClick={() => acceptCall(incomingCall)}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-lg font-bold shadow-md hover:shadow-lg transition-all"
              >
                Accept Call
              </button>
              <button
                onClick={() => rejectCall(incomingCall)}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-lg font-bold shadow-md hover:shadow-lg transition-all"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="container mx-auto px-4 sm:px-6 py-6">
        <button
          onClick={() => router.back()}
          className="text-slate-600 hover:text-slate-900 transition-colors mb-4 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Contacts
        </button>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{displayName}</h1>
            {contact.business_name && (
              <p className="text-lg text-slate-600 mt-1">{fullName}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCall}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-lg font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call
            </button>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="bg-white hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-lg font-medium shadow-sm hover:shadow-md transition-all border border-slate-200"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 px-6 py-3 rounded-lg font-medium shadow-sm hover:shadow-md transition-all border border-slate-200"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Contact Details Card */}
      <div className="container mx-auto px-4 sm:px-6 pb-8">
        <div className="backdrop-blur-lg bg-white/70 rounded-xl shadow-lg border border-white/20 p-6 sm:p-8 mb-6">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Contact Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Phone */}
            <div>
              <label className="text-sm font-medium text-slate-500 uppercase tracking-wide">Phone</label>
              <div className="mt-1 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <p className="text-lg font-semibold text-slate-900 font-mono">{formatPhoneNumber(contact.phone)}</p>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-medium text-slate-500 uppercase tracking-wide">Email</label>
              <div className="mt-1 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-lg text-slate-900">{contact.email || 'N/A'}</p>
              </div>
            </div>

            {/* Address */}
            {(contact.address || contact.city || contact.state || contact.zip) && (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-500 uppercase tracking-wide">Address</label>
                <div className="mt-1 flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="text-lg text-slate-900">
                    {contact.address && <p>{contact.address}</p>}
                    {(contact.city || contact.state || contact.zip) && (
                      <p>{[contact.city, contact.state, contact.zip].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Call History */}
        <div className="backdrop-blur-lg bg-white/70 rounded-xl shadow-lg border border-white/20 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">Call History</h2>

          {callHistory.length === 0 ? (
            <p className="text-slate-600 text-center py-8">No call history with this contact</p>
          ) : (
            <div className="space-y-3">
              {callHistory.map((call) => {
                const isInbound = call.to_number === contact.phone
                return (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-4 bg-white/50 rounded-lg border border-slate-200 hover:border-blue-300 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isInbound ? 'bg-green-100' : 'bg-blue-100'
                      }`}>
                        <svg className={`w-5 h-5 ${isInbound ? 'text-green-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isInbound ? "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" : "M16 3h5m0 0v5m0-5l-6 6M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"} />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {isInbound ? 'Outbound Call' : 'Inbound Call'}
                        </p>
                        <p className="text-sm text-slate-600">{formatDate(call.started_at)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-slate-900">{formatDuration(call.duration)}</p>
                      <p className={`text-sm font-medium ${
                        call.status === 'completed' ? 'text-green-600' : 'text-slate-500'
                      }`}>
                        {call.status}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <ContactFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          setIsEditModalOpen(false)
          // Refetch contact data
          window.location.reload()
        }}
        contact={contact}
      />
    </div>
  )
}

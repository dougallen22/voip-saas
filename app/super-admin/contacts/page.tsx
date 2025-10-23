'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Navigation from '@/components/super-admin/Navigation'
import ContactCard from '@/components/super-admin/contacts/ContactCard'
import ContactFormModal from '@/components/super-admin/contacts/ContactFormModal'
import { useTwilioDevice } from '@/hooks/useTwilioDevice'
import IncomingCallCard from '@/components/super-admin/calling/IncomingCallCard'
import ActiveCallBanner from '@/components/super-admin/calling/ActiveCallBanner'

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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  // Twilio device for incoming calls and click-to-call
  const {
    incomingCall,
    activeCall,
    acceptCall,
    rejectCall,
    device,
    currentUserId,
    makeOutboundCall,
    outboundCall,
    outboundCallStatus,
    callStartTime
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

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/contacts/list')
      const data = await response.json()

      if (response.ok) {
        setContacts(data.contacts || [])
        setFilteredContacts(data.contacts || [])
      } else {
        console.error('Failed to fetch contacts:', data.error)
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  // Realtime subscription for contacts
  useEffect(() => {
    const channel = supabase
      .channel('contacts-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'contacts'
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setContacts(prev => [payload.new as Contact, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setContacts(prev => prev.map(c =>
            c.id === payload.new.id ? payload.new as Contact : c
          ))
        } else if (payload.eventType === 'DELETE') {
          setContacts(prev => prev.filter(c => c.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // Search filter with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim() === '') {
        setFilteredContacts(contacts)
      } else {
        const term = searchTerm.toLowerCase()
        const filtered = contacts.filter(contact =>
          contact.first_name.toLowerCase().includes(term) ||
          contact.last_name.toLowerCase().includes(term) ||
          (contact.business_name && contact.business_name.toLowerCase().includes(term)) ||
          contact.phone.includes(term) ||
          (contact.email && contact.email.toLowerCase().includes(term))
        )
        setFilteredContacts(filtered)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, contacts])

  const handleAddContact = () => {
    setEditingContact(null)
    setIsModalOpen(true)
  }

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setIsModalOpen(true)
  }

  const handleDeleteContact = async (contactId: string) => {
    try {
      const response = await fetch('/api/contacts/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contactId }),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to delete contact')
        return
      }

      // Contact will be removed via realtime subscription
    } catch (error) {
      console.error('Error deleting contact:', error)
      alert('An error occurred while deleting the contact')
    }
  }

  const handleCall = async (phone: string, name: string) => {
    try {
      console.log('Initiating call to:', name, phone)
      await makeOutboundCall(phone, name)
      // Show success feedback (optional - the UI will update via outboundCallStatus)
      console.log('Call initiated successfully')
    } catch (error: any) {
      console.error('Error initiating call:', error)
      alert(error.message || 'Failed to initiate call. Please try again.')
    }
  }

  const handleAnswerCall = async () => {
    console.log('🚀 handleAnswerCall CALLED', {
      hasIncomingCall: !!incomingCall,
      hasCurrentUserId: !!currentUserId,
      currentUserId,
      callSid: incomingCall?.parameters?.CallSid
    })

    if (!incomingCall || !currentUserId) {
      console.log('❌ ABORT: Missing incomingCall or currentUserId')
      return
    }

    console.log('📞 Attempting to answer call')

    try {
      // CRITICAL FIX: Accept call FIRST to establish audio
      // This gives us access to the Call object with parentCallSid
      console.log('🎧 Accepting call to establish audio connection')
      await acceptCall()

      console.log('📞 Call accepted, audio connected')

      // Now check if we need to claim (in case another agent also answered)
      // Use a small delay to let Twilio events propagate
      setTimeout(async () => {
        try {
          const callSid = incomingCall.parameters.CallSid

          console.log('🔄 Sending claim-call API request', { callSid, agentId: currentUserId })

          const claimResponse = await fetch('/api/twilio/claim-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callSid: callSid,
              agentId: currentUserId
            })
          })

          const claimResult = await claimResponse.json()
          console.log('📥 claim-call API response', { status: claimResponse.status, result: claimResult })

          if (!claimResult.success) {
            console.log('⚠️ Another agent claimed - they will keep the call')
            // Another agent claimed it, so disconnect our call
            if (activeCall) {
              activeCall.disconnect()
            }
          } else {
            console.log('✅ Successfully claimed call')
          }
        } catch (error) {
          console.error('❌ Error in post-answer claim:', error)
        }
      }, 100)

    } catch (error) {
      console.error('❌ Error answering call:', error)
    }
  }

  const handleModalSuccess = () => {
    // Contacts will update via realtime subscription
    fetchContacts() // Also fetch to ensure we have latest
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Navigation Menu */}
      <Navigation userRole={currentUserRole || undefined} />

      {/* Incoming Call Banner */}
      {incomingCall && !activeCall && (
        <div className="sticky top-16 z-30 backdrop-blur-sm bg-white/50 border-b border-orange-200">
          <div className="container mx-auto px-4 sm:px-6 py-4">
            <IncomingCallCard callerNumber={incomingCall.parameters.From} />
            <div className="flex gap-3 mt-3">
              <button
                onClick={handleAnswerCall}
                className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-lg font-bold shadow-md hover:shadow-lg transition-all"
              >
                Accept Call
              </button>
              <button
                onClick={() => rejectCall()}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-lg font-bold shadow-md hover:shadow-lg transition-all"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Call Banner */}
      {activeCall && (
        <div className="sticky top-16 z-30 backdrop-blur-sm bg-white/50 border-b border-green-200">
          <div className="container mx-auto px-4 sm:px-6 py-4">
            <ActiveCallBanner
              call={activeCall}
              callStartTime={callStartTime}
              onEndCall={() => {
                if (activeCall) {
                  activeCall.disconnect()
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Page Header */}
      <header className="container mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-blue-900 bg-clip-text text-transparent">
              Contacts
            </h1>
            <p className="text-slate-600 mt-1">Manage your customer contacts</p>
          </div>
          <button
            onClick={handleAddContact}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Contact
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="container mx-auto px-4 sm:px-6 mb-6">
        <div className="relative max-w-xl">
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search contacts by name, company, phone, or email..."
            className="w-full px-5 py-3 pl-12 pr-12 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
          />
          <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Results count */}
        <p className="text-sm text-slate-600 mt-2">
          {isLoading ? 'Loading...' : `${filteredContacts.length} contact${filteredContacts.length !== 1 ? 's' : ''}`}
          {searchTerm && ` matching "${searchTerm}"`}
        </p>
      </div>

      {/* Contacts List */}
      <div className="container mx-auto px-4 sm:px-6 pb-8">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="backdrop-blur-md bg-white/80 rounded-xl shadow-md p-4 border border-white/20 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-slate-200 rounded-full flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-9 h-9 bg-slate-200 rounded-full"></div>
                    <div className="w-9 h-9 bg-slate-200 rounded-full"></div>
                    <div className="w-9 h-9 bg-slate-200 rounded-full"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              {searchTerm ? 'No contacts found' : 'No contacts yet'}
            </h3>
            <p className="text-slate-600 mb-6">
              {searchTerm
                ? 'Try adjusting your search terms'
                : 'Add your first contact to get started'}
            </p>
            {!searchTerm && (
              <button
                onClick={handleAddContact}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-medium shadow-sm hover:shadow-md transition-all inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Your First Contact
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredContacts.map(contact => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onEdit={handleEditContact}
                onDelete={handleDeleteContact}
                onCall={handleCall}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contact Form Modal */}
      <ContactFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingContact(null)
        }}
        onSuccess={handleModalSuccess}
        contact={editingContact}
      />
    </div>
  )
}

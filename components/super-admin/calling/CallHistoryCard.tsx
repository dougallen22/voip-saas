'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Contact {
  id: string
  first_name: string
  last_name: string
  business_name: string | null
}

interface CallRecord {
  id: string
  from_number: string
  to_number: string
  status: string
  direction: string
  answered_by_user_id: string | null
  answered_at: string | null
  created_at: string
  duration: number | null
  answered_by_user?: {
    full_name: string
  }
  contact?: Contact
}

export default function CallHistoryCard() {
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  const fetchCalls = async () => {
    try {
      // Get date 7 days ago
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoISO = sevenDaysAgo.toISOString()

      console.log('📅 Fetching calls from last 7 days (since:', sevenDaysAgoISO, ')')

      // Fetch calls from last 7 days
      const { data: callsData, error: callsError } = await supabase
        .from('calls')
        .select(`
          id,
          from_number,
          to_number,
          status,
          direction,
          answered_by_user_id,
          answered_at,
          created_at,
          duration
        `)
        .gte('created_at', sevenDaysAgoISO)
        .order('created_at', { ascending: false })

      if (callsError) throw callsError

      // Fetch user data via API endpoint
      const response = await fetch('/api/saas-users/list', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      const { users: allUsers } = await response.json()

      // Create users map
      const usersMap: Record<string, { full_name: string }> = {}
      allUsers?.forEach((user: any) => {
        if (user.id && user.full_name) {
          usersMap[user.id] = { full_name: user.full_name }
        }
      })

      // Merge user data with calls
      const callsWithUsers = callsData?.map(call => ({
        ...call,
        answered_by_user: call.answered_by_user_id ? usersMap[call.answered_by_user_id] : undefined
      })) || []

      // Fetch contacts for phone numbers
      console.log('🔍 Fetching contact names for phone numbers...')
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, phone, first_name, last_name, business_name')

      // Create phone number to contact map
      const contactsMap: Record<string, Contact> = {}
      contacts?.forEach((contact: any) => {
        if (contact.phone) {
          // Normalize phone number for comparison (remove +1, spaces, dashes)
          const normalizedPhone = contact.phone.replace(/[\s\-+]/g, '')
          contactsMap[normalizedPhone] = {
            id: contact.id,
            first_name: contact.first_name,
            last_name: contact.last_name,
            business_name: contact.business_name
          }
        }
      })

      // Attach contact info to each call
      const callsWithContacts = callsWithUsers.map(call => {
        // For inbound calls, check from_number
        // For outbound calls, check to_number
        const phoneToCheck = call.direction === 'inbound' ? call.from_number : call.to_number
        const normalizedPhone = phoneToCheck.replace(/[\s\-+]/g, '')

        // Try different normalizations
        let contact = contactsMap[normalizedPhone]
        if (!contact && normalizedPhone.startsWith('1') && normalizedPhone.length === 11) {
          // Try without leading 1
          contact = contactsMap[normalizedPhone.slice(1)]
        }
        if (!contact && normalizedPhone.length === 10) {
          // Try with leading 1
          contact = contactsMap['1' + normalizedPhone]
        }

        return {
          ...call,
          contact
        }
      })

      console.log('📞 Fetched calls from last 7 days:', {
        totalCalls: callsWithContacts.length,
        answeredCalls: callsWithContacts.filter(c => c.answered_by_user_id).length,
        missedCalls: callsWithContacts.filter(c => !c.answered_by_user_id && (c.status === 'ringing' || c.status === 'no-answer' || c.status === 'busy')).length,
        usersFound: Object.keys(usersMap).length,
        contactsFound: callsWithContacts.filter(c => c.contact).length
      })

      setCalls(callsWithContacts)
    } catch (error) {
      console.error('Error fetching call history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCalls()

    // Subscribe to new calls
    const channel = supabase
      .channel('call-history-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
        },
        () => {
          console.log('📞 Call history changed, refreshing...')
          fetchCalls()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 11 && digits[0] === '1') {
      const number = digits.slice(1)
      return `${number.slice(0, 3)}-${number.slice(3, 6)}-${number.slice(6)}`
    } else if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    }
    return phone.replace('+', '')
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const getStatusInfo = (call: CallRecord) => {
    // Missed call: ringing status and no answered_by_user_id
    if ((call.status === 'ringing' || call.status === 'no-answer' || call.status === 'busy') && !call.answered_by_user_id) {
      return {
        type: 'missed',
        label: 'Missed',
        color: 'bg-red-100 text-red-700 border-red-200',
        icon: '📵'
      }
    }

    // Accepted call: has answered_by_user_id
    if (call.answered_by_user_id) {
      return {
        type: 'accepted',
        label: 'Answered',
        color: 'bg-green-100 text-green-700 border-green-200',
        icon: '✅'
      }
    }

    // Default/other
    return {
      type: 'other',
      label: call.status,
      color: 'bg-slate-100 text-slate-600 border-slate-200',
      icon: '📞'
    }
  }

  if (isLoading) {
    return (
      <div className="backdrop-blur-lg bg-white/70 rounded-xl shadow-lg border border-white/20 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="backdrop-blur-lg bg-white/70 rounded-xl shadow-lg border border-white/20 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-50/80 to-white/60 backdrop-blur-sm p-4 sm:p-6 border-b border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-slate-500 to-slate-600 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">📋</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Call History</h3>
              <p className="text-xs text-slate-500">Last 7 days</p>
            </div>
          </div>
          <span className="bg-slate-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
            {calls.length}
          </span>
        </div>
      </div>

      {/* Call List */}
      <div className="max-h-96 overflow-y-auto">
        {calls.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">📞</span>
            </div>
            <p className="text-sm text-slate-400 font-medium">No calls yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {calls.map((call) => {
              const status = getStatusInfo(call)
              return (
                <div
                  key={call.id}
                  className="p-3 sm:p-4 hover:bg-white/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Direction Icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      call.direction === 'inbound'
                        ? 'bg-green-100'
                        : 'bg-amber-100'
                    }`}>
                      <span className="text-sm">
                        {call.direction === 'inbound' ? '📥' : '📤'}
                      </span>
                    </div>

                    {/* Call Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex flex-col">
                          {call.contact ? (
                            <>
                              <span className="font-bold text-sm text-slate-900">
                                {call.contact.business_name || `${call.contact.first_name} ${call.contact.last_name}`}
                              </span>
                              <span className="font-mono text-xs text-slate-500">
                                {formatPhoneNumber(call.direction === 'inbound' ? call.from_number : call.to_number)}
                              </span>
                            </>
                          ) : (
                            <span className="font-mono font-bold text-sm text-slate-900">
                              {formatPhoneNumber(call.direction === 'inbound' ? call.from_number : call.to_number)}
                            </span>
                          )}
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${status.color}`}>
                          <span>{status.icon}</span>
                          {status.label}
                        </span>
                      </div>

                      {/* Answered By / Called By */}
                      {call.answered_by_user_id && call.direction === 'inbound' && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                            <span className="text-white text-[10px] font-bold">
                              {call.answered_by_user?.full_name
                                ? call.answered_by_user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                                : '?'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-600">
                            Answered by <span className="font-bold text-blue-700">
                              {call.answered_by_user?.full_name || 'Agent'}
                            </span>
                          </span>
                        </div>
                      )}
                      {call.answered_by_user_id && call.direction === 'outbound' && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm">
                            <span className="text-white text-[10px] font-bold">
                              {call.answered_by_user?.full_name
                                ? call.answered_by_user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                                : '?'}
                            </span>
                          </div>
                          <span className="text-xs text-slate-600">
                            Called by <span className="font-bold text-amber-700">
                              {call.answered_by_user?.full_name || 'Agent'}
                            </span>
                          </span>
                        </div>
                      )}
                      {!call.answered_by_user_id && status.type === 'missed' && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                            <span className="text-red-600 text-xs">✕</span>
                          </div>
                          <span className="text-xs text-red-600 font-medium">
                            No answer
                          </span>
                        </div>
                      )}

                      {/* Duration & Time */}
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {call.duration && (
                          <>
                            <span className="font-mono">{formatDuration(call.duration)}</span>
                            <span>•</span>
                          </>
                        )}
                        <span>{formatDateTime(call.created_at)}</span>
                        <span>•</span>
                        <span className="capitalize">{call.direction}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

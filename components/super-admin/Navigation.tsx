'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface NavigationProps {
  userRole?: string
}

interface Notification {
  id: string
  type: 'sms' | 'missed_call'
  title: string
  body: string
  time: string
  link: string
}

export default function Navigation({ userRole }: NavigationProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(userRole || null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isRinging, setIsRinging] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const notificationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userRole) {
      // Fetch user role if not provided
      const fetchUserRole = async () => {
        const supabase = createClient()
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
    }
  }, [userRole])

  // Fetch and subscribe to unread message count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      // Fetch conversations and sum unread counts
      const { data: conversations } = await supabase
        .from('sms_conversations')
        .select('unread_count')

      const total = conversations?.reduce((sum, conv) => sum + (conv.unread_count || 0), 0) || 0
      setUnreadCount(total)
    }

    fetchUnreadCount()

    // Subscribe to real-time updates
    const supabase = createClient()
    const channel = supabase
      .channel('navigation-sms-notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sms_conversations'
      }, (payload) => {
        // Trigger ring animation on new/updated messages
        setIsRinging(true)
        setTimeout(() => setIsRinging(false), 1000)

        // Re-fetch unread count
        fetchUnreadCount()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Fetch notifications (recent SMS and missed calls)
  useEffect(() => {
    const fetchNotifications = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const notifs: Notification[] = []

      // Fetch recent unread SMS messages (last 5)
      const { data: smsConversations } = await supabase
        .from('sms_conversations')
        .select('id, contact_name, contact_phone_number, last_message_preview, last_message_at, unread_count')
        .gt('unread_count', 0)
        .order('last_message_at', { ascending: false })
        .limit(5)

      smsConversations?.forEach(conv => {
        notifs.push({
          id: `sms-${conv.id}`,
          type: 'sms',
          title: conv.contact_name || conv.contact_phone_number,
          body: conv.last_message_preview,
          time: new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          link: `/super-admin/messages?conversation=${conv.id}`
        })
      })

      // Fetch recent missed calls (last 5)
      const { data: missedCalls } = await supabase
        .from('call_history')
        .select('id, contact_name, contact_phone, direction, status, created_at')
        .eq('direction', 'inbound')
        .in('status', ['no-answer', 'busy', 'failed'])
        .order('created_at', { ascending: false })
        .limit(5)

      missedCalls?.forEach(call => {
        notifs.push({
          id: `call-${call.id}`,
          type: 'missed_call',
          title: call.contact_name || call.contact_phone || 'Unknown',
          body: 'Missed call',
          time: new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          link: '/super-admin/calling'
        })
      })

      // Sort by most recent
      notifs.sort((a, b) => b.time.localeCompare(a.time))

      setNotifications(notifs.slice(0, 10))
    }

    fetchNotifications()
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showNotifications])

  const menuItems = [
    { href: '/super-admin/dashboard', label: 'Dashboard', icon: DashboardIcon },
    { href: '/super-admin/calling', label: 'Calling', icon: PhoneIcon },
    { href: '/super-admin/messages', label: 'Messages', icon: MessageIcon },
    { href: '/super-admin/contacts', label: 'Contacts', icon: ContactsIcon },
    { href: '/super-admin/agents', label: 'Agents', icon: UsersIcon, superAdminOnly: true },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <nav className="sticky top-0 z-40 backdrop-blur-lg bg-white/70 border-b border-white/20 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <span className="hidden sm:inline-block text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
              VoIP CRM
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-1">
            {menuItems.map((item) => {
              // Hide super admin only items for non-super admins
              if (item.superAdminOnly && currentUserRole !== 'super_admin') {
                return null
              }

              const Icon = item.icon
              const active = isActive(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    active
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                      : 'text-slate-700 hover:bg-white/50 hover:text-blue-600'
                  }`}
                >
                  <Icon active={active} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>

          {/* Bell Notification Icon with Dropdown */}
          <div ref={notificationRef} className="hidden md:flex relative ml-4">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-2 rounded-full transition-all ${
                isRinging ? 'animate-bounce' : ''
              } ${
                unreadCount > 0
                  ? 'bg-red-50 hover:bg-red-100 text-red-600'
                  : 'bg-white/50 hover:bg-white/70 text-slate-600'
              }`}
              title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
            >
              <svg
                className={`w-6 h-6 ${isRinging ? 'animate-bounce' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-12 w-96 bg-white rounded-lg shadow-2xl border border-slate-200 max-h-[500px] overflow-hidden z-50">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
                  <h3 className="font-bold text-slate-900 text-lg">Notifications</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {notifications.length > 0 ? `${notifications.length} recent` : 'No new notifications'}
                  </p>
                </div>

                {/* Notification List */}
                <div className="overflow-y-auto max-h-[400px]">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <p className="text-sm">No new notifications</p>
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <button
                        key={notif.id}
                        onClick={() => {
                          router.push(notif.link)
                          setShowNotifications(false)
                        }}
                        className="w-full p-4 border-b border-slate-100 hover:bg-blue-50 transition-colors text-left flex items-start gap-3"
                      >
                        {/* Icon */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                          notif.type === 'sms'
                            ? 'bg-purple-100 text-purple-600'
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {notif.type === 'sms' ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="font-semibold text-sm text-slate-900 truncate">{notif.title}</p>
                            <span className="text-xs text-slate-500 whitespace-nowrap">{notif.time}</span>
                          </div>
                          <p className="text-sm text-slate-600 truncate">{notif.body}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {notif.type === 'sms' ? 'New message' : 'Missed call'}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="p-3 border-t border-slate-200 bg-slate-50">
                    <button
                      onClick={() => {
                        router.push('/super-admin/messages')
                        setShowNotifications(false)
                      }}
                      className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View all notifications
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-white/50 transition-all"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/20">
            <div className="flex flex-col gap-2">
              {menuItems.map((item) => {
                // Hide super admin only items for non-super admins
                if (item.superAdminOnly && currentUserRole !== 'super_admin') {
                  return null
                }

                const Icon = item.icon
                const active = isActive(item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                      active
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                        : 'text-slate-700 hover:bg-white/50 hover:text-blue-600'
                    }`}
                  >
                    <Icon active={active} />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

// Icon Components
function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function PhoneIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  )
}

function ContactsIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function MessageIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  )
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

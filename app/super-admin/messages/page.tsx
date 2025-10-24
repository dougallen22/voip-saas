'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Navigation from '@/components/super-admin/Navigation'

interface Conversation {
  id: string
  contact_id: string
  contact_name: string
  contact_phone: string
  last_message_at: string
  last_message_preview: string
  unread_count: number
  contact: {
    first_name: string
    last_name: string
    business_name: string | null
  }
}

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  from_number: string
  to_number: string
  body: string
  media_urls: string[]
  status: string
  created_at: string
  sender: { full_name: string } | null
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const supabase = useMemo(() => createClient(), [])

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      setIsLoading(true)
      console.log('Fetching conversations...')
      const response = await fetch('/api/sms/conversations/list')
      const data = await response.json()
      console.log('Conversations API response:', { status: response.status, data })
      if (response.ok) {
        setConversations(data.conversations || [])
        console.log('Set conversations:', data.conversations?.length || 0)

        // Auto-select first conversation if none selected
        if (!selectedConversationId && data.conversations?.length > 0) {
          setSelectedConversationId(data.conversations[0].id)
          console.log('Auto-selected conversation:', data.conversations[0].id)
        }
      } else {
        console.error('Failed to fetch conversations:', data.error)
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch messages for selected conversation
  const fetchMessages = async (conversationId: string) => {
    try {
      setIsLoadingMessages(true)
      console.log('Fetching messages for conversation:', conversationId)
      const response = await fetch(`/api/sms/messages/list?conversation_id=${conversationId}`)
      const data = await response.json()
      console.log('Messages API response:', data)
      if (response.ok) {
        setMessages(data.messages || [])
        console.log('Set messages:', data.messages?.length || 0)
      } else {
        console.error('Failed to fetch messages:', data.error)
      }
    } catch (error) {
      console.error('Error fetching messages:', error)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  // Mark conversation as read
  const markAsRead = async (conversationId: string) => {
    try {
      console.log('Marking conversation as read:', conversationId)
      const response = await fetch('/api/sms/messages/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversation_id: conversationId })
      })

      if (response.ok) {
        console.log('Successfully marked as read')
      } else {
        const error = await response.json()
        console.error('Failed to mark as read:', error)
      }
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversationId) return

    const conversation = conversations.find(c => c.id === selectedConversationId)
    if (!conversation) return

    setIsSending(true)
    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          contact_id: conversation.contact_id,
          message: newMessage
        })
      })

      if (response.ok) {
        setNewMessage('')
        // Message will appear via realtime subscription
      } else {
        const error = await response.json()
        alert(`Failed to send: ${error.error}`)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchConversations()
  }, [])

  // Load messages when conversation selected
  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages(selectedConversationId)
      // Mark as read after a short delay to ensure messages are loaded
      setTimeout(() => {
        markAsRead(selectedConversationId)
      }, 500)
    }
  }, [selectedConversationId])

  // Realtime subscription for new messages
  useEffect(() => {
    if (!selectedConversationId) return

    const channel = supabase
      .channel('sms-messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'sms_messages',
        filter: `conversation_id=eq.${selectedConversationId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedConversationId, supabase])

  // Realtime subscription for conversation list updates
  useEffect(() => {
    const channel = supabase
      .channel('sms-conversations-realtime')
      .on('postgres_changes', {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'sms_conversations'
      }, () => {
        // Refresh conversations list when any conversation changes
        fetchConversations()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return date.toLocaleDateString()
  }

  const selectedConversation = conversations.find(c => c.id === selectedConversationId)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Navigation />

      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-blue-900 bg-clip-text text-transparent mb-6">
          Messages
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-200px)]">
          {/* Conversations List */}
          <div className="md:col-span-1 bg-white/80 backdrop-blur-md rounded-xl shadow-md border border-white/20 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <input
                type="search"
                placeholder="Search conversations..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="overflow-y-auto h-full">
              {isLoading ? (
                <div className="p-4 text-center text-slate-500">Loading...</div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <p className="mb-2">No conversations yet</p>
                  <p className="text-sm">Send your first text from a contact</p>
                </div>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-blue-50 transition-colors ${
                      selectedConversationId === conv.id ? 'bg-blue-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold">
                        {conv.contact_name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-sm truncate">{conv.contact_name}</h3>
                          <span className="text-xs text-slate-500">{formatTime(conv.last_message_at)}</span>
                        </div>
                        <p className="text-xs text-slate-600 truncate">{conv.last_message_preview}</p>
                      </div>
                      {conv.unread_count > 0 && (
                        <div className="bg-blue-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                          {conv.unread_count}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Message Thread */}
          <div className="md:col-span-2 bg-white/80 backdrop-blur-md rounded-xl shadow-md border border-white/20 flex flex-col">
            {selectedConversation ? (
              <>
                {/* Header */}
                <div className="p-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-lg">{selectedConversation.contact_name}</h2>
                      <p className="text-sm text-slate-600">{selectedConversation.contact_phone}</p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                  {isLoadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                        <p className="text-slate-500 text-sm">Loading messages...</p>
                      </div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-slate-400">
                        <svg className="w-16 h-16 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <p className="text-sm">No messages yet</p>
                        <p className="text-xs mt-1">Send your first message below</p>
                      </div>
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex flex-col ${msg.direction === 'outbound' ? 'items-end' : 'items-start'} max-w-[70%]`}>
                          {/* Message bubble */}
                          <div
                            className={`px-4 py-3 rounded-2xl shadow-sm ${
                              msg.direction === 'outbound'
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-br-md'
                                : 'bg-white text-slate-900 border border-slate-200 rounded-bl-md'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                          </div>
                          {/* Timestamp and status */}
                          <div className={`flex items-center gap-2 mt-1 px-2 ${
                            msg.direction === 'outbound' ? 'flex-row-reverse' : 'flex-row'
                          }`}>
                            <span className="text-xs text-slate-500">{formatTime(msg.created_at)}</span>
                            {msg.direction === 'outbound' && (
                              <span className="text-xs text-slate-500">
                                {msg.status === 'delivered' ? '✓✓ Delivered' :
                                 msg.status === 'sent' ? '✓ Sent' :
                                 msg.status === 'undelivered' ? '✗ Failed' :
                                 '⋯ Sending'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-slate-200">
                  <div className="flex gap-2">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSend()
                        }
                      }}
                      placeholder="Type a message..."
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={2}
                      disabled={isSending}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!newMessage.trim() || isSending}
                      className="px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isSending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{newMessage.length}/1600</p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <p>Select a conversation to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

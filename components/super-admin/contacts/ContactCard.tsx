'use client'

import { useRouter } from 'next/navigation'

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

interface ContactCardProps {
  contact: Contact
  onEdit: (contact: Contact) => void
  onDelete: (contactId: string) => void
  onCall: (phone: string, name: string) => void
}

export default function ContactCard({ contact, onEdit, onDelete, onCall }: ContactCardProps) {
  const router = useRouter()
  const fullName = `${contact.first_name} ${contact.last_name}`
  const displayName = contact.business_name || fullName

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

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (confirm(`Are you sure you want to delete ${displayName}?`)) {
      onDelete(contact.id)
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onEdit(contact)
  }

  const handleCall = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onCall(contact.phone, fullName)
  }

  const handleCardClick = () => {
    router.push(`/super-admin/contacts/${contact.id}`)
  }

  return (
    <div
      onClick={handleCardClick}
      className="backdrop-blur-md bg-white/80 rounded-xl shadow-md p-4 border border-white/20 shadow-slate-900/5 transition-all hover:shadow-lg cursor-pointer"
    >
      {/* Main horizontal layout */}
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-md ring-2 ring-slate-200 ring-offset-2 transition-all">
          {getInitials(displayName)}
        </div>

        {/* Contact info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-sm text-slate-900 truncate">
              {displayName}
            </h3>
            {contact.business_name && (
              <span className="inline-flex items-center bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                {fullName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono font-semibold text-slate-700">{formatPhoneNumber(contact.phone)}</span>
            {contact.email && (
              <>
                <span>•</span>
                <span className="truncate">{contact.email}</span>
              </>
            )}
            {(contact.city || contact.state) && (
              <>
                <span>•</span>
                <span className="truncate">{[contact.city, contact.state].filter(Boolean).join(', ')}</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Call Button */}
          <button
            onClick={handleCall}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white hover:shadow-md"
            title="Call contact"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>

          {/* Text Button */}
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              window.location.href = `/super-admin/messages?contact=${contact.id}`
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white hover:shadow-md"
            title="Send text message"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>

          {/* Edit Button */}
          <button
            onClick={handleEdit}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white hover:shadow-md"
            title="Edit contact"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white hover:shadow-md"
            title="Delete contact"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

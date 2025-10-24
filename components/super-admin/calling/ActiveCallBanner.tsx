'use client'

import { useEffect, useState } from 'react'
import { Call } from '@twilio/voice-sdk'

interface ActiveCallBannerProps {
  call: Call
  callStartTime: Date | null
  onEndCall: () => void
  contactName?: string | null
}

export default function ActiveCallBanner({ call, callStartTime, onEndCall, contactName }: ActiveCallBannerProps) {
  const [duration, setDuration] = useState(0)

  // Update duration every second
  useEffect(() => {
    if (!callStartTime) return

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTime.getTime()) / 1000)
      setDuration(elapsed)
    }, 1000)

    return () => clearInterval(interval)
  }, [callStartTime])

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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const callerNumber = call.parameters.From || 'Unknown'

  return (
    <div className="mb-4 p-4 backdrop-blur-md bg-gradient-to-br from-green-50/90 to-emerald-50/90 border-2 border-green-400 rounded-xl shadow-lg shadow-green-200/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {/* Green pulsing indicator */}
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-75"></div>
            <div className="relative w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-md">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
          </div>

          <div className="flex-1">
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Active Call</p>

            {/* Show contact name if available */}
            {contactName && (
              <p className="text-base font-bold text-green-900">{contactName}</p>
            )}

            <p className={`font-mono text-green-900 ${contactName ? 'text-sm font-semibold' : 'text-lg font-bold'}`}>
              {formatPhoneNumber(callerNumber)}
            </p>
            <p className="text-sm text-green-600 font-mono">{formatDuration(duration)}</p>
          </div>
        </div>

        {/* End Call Button */}
        <button
          onClick={onEndCall}
          className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all"
        >
          End Call
        </button>
      </div>
    </div>
  )
}

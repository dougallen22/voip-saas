'use client'

import { useEffect, useState } from 'react'

interface IncomingCallAlertProps {
  call: {
    id: string
    from_number: string
  }
  onAccept: () => void
  onReject: () => void
}

export default function IncomingCallAlert({ call, onAccept, onReject }: IncomingCallAlertProps) {
  const [timer, setTimer] = useState(30)

  useEffect(() => {
    // Auto-reject after 30 seconds
    const countdown = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          onReject()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Ring sound (optional - can add audio later)
    // const audio = new Audio('/ring.mp3')
    // audio.loop = true
    // audio.play()

    return () => {
      clearInterval(countdown)
      // audio.pause()
    }
  }, [onReject])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 animate-pulse">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        {/* Incoming Call Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center animate-bounce">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
        </div>

        {/* Call Info */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Incoming Call</h2>
          <p className="text-lg text-slate-600">{call.from_number}</p>
          <p className="text-sm text-slate-500 mt-2">Auto-reject in {timer}s</p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={onReject}
            className="flex-1 bg-red-600 text-white py-4 px-6 rounded-xl hover:bg-red-700 font-semibold text-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Reject
          </button>
          <button
            onClick={onAccept}
            className="flex-1 bg-green-600 text-white py-4 px-6 rounded-xl hover:bg-green-700 font-semibold text-lg transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}

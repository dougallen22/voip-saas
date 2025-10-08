'use client'

interface IncomingCallCardProps {
  callerNumber: string
}

export default function IncomingCallCard({ callerNumber }: IncomingCallCardProps) {
  return (
    <div className="mb-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-orange-400 rounded-lg animate-pulse">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-orange-900">Incoming Call</p>
          <p className="text-lg font-bold text-orange-800">{callerNumber}</p>
        </div>
      </div>
    </div>
  )
}

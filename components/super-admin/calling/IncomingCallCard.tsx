'use client'

interface IncomingCallCardProps {
  callerNumber: string
}

export default function IncomingCallCard({ callerNumber }: IncomingCallCardProps) {
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

  return (
    <div className="mb-4 p-3 backdrop-blur-md bg-gradient-to-br from-orange-50/90 to-yellow-50/90 border-2 border-orange-300 rounded-xl animate-pulse shadow-lg shadow-orange-200/50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center shadow-md">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Incoming Call</p>
          <p className="text-lg font-bold font-mono text-orange-900">{formatPhoneNumber(callerNumber)}</p>
        </div>
      </div>
    </div>
  )
}

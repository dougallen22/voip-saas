'use client'

interface TransferCallCardProps {
  callerNumber: string
  onAnswer: () => void
  onDecline: () => void
}

export default function TransferCallCard({ callerNumber, onAnswer, onDecline }: TransferCallCardProps) {
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

  const handleAnswer = () => {
    console.log('🟢 ACCEPT BUTTON CLICKED', { callerNumber })
    onAnswer()
  }

  const handleDecline = () => {
    console.log('🔴 DECLINE BUTTON CLICKED', { callerNumber })
    onDecline()
  }

  return (
    <div className="mb-4 p-4 backdrop-blur-md bg-gradient-to-br from-blue-50/90 to-indigo-50/90 border-2 border-blue-400 rounded-xl shadow-lg shadow-blue-200/50">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Incoming Call</p>
          <p className="text-lg font-bold font-mono text-blue-900">{formatPhoneNumber(callerNumber)}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAnswer}
          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-2.5 px-3 rounded-lg transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          Answer
        </button>
        <button
          onClick={handleDecline}
          className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-2.5 px-3 rounded-lg transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Decline
        </button>
      </div>
    </div>
  )
}

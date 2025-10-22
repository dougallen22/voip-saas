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
    <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-500 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-900">Incoming Call</p>
          <p className="text-lg font-bold text-blue-800">{formatPhoneNumber(callerNumber)}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAnswer}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-2 rounded-lg transition-colors flex items-center justify-center gap-1 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          Answer
        </button>
        <button
          onClick={handleDecline}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-2 rounded-lg transition-colors flex items-center justify-center gap-1 text-sm"
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

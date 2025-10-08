'use client'

interface TransferButtonProps {
  onTransfer: () => void
  disabled?: boolean
}

export default function TransferButton({ onTransfer, disabled }: TransferButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onTransfer()
      }}
      disabled={disabled}
      className={`
        px-3 py-1 rounded-md text-sm font-semibold transition-colors
        ${disabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-blue-600 text-white hover:bg-blue-700'
        }
      `}
    >
      Transfer
    </button>
  )
}

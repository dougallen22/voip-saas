/**
 * Phone number formatting utilities for Twilio integration
 */

/**
 * Format phone number to E.164 format (+1XXXXXXXXXX for US numbers)
 * Accepts formats: xxx-xxx-xxxx, (xxx) xxx-xxxx, xxxxxxxxxx, +1xxxxxxxxxx
 */
export function formatToE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')

  // Handle US numbers (10 or 11 digits)
  if (digits.length === 10) {
    // Add +1 prefix for US
    return `+1${digits}`
  } else if (digits.length === 11 && digits[0] === '1') {
    // Already has 1 prefix, just add +
    return `+${digits}`
  } else if (digits.length > 11) {
    // Already has country code, add + if needed
    return phone.startsWith('+') ? phone : `+${digits}`
  }

  throw new Error('Invalid phone number format. Please use a valid US phone number.')
}

/**
 * Format phone number for display (xxx-xxx-xxxx)
 */
export function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  if (digits.length === 11 && digits[0] === '1') {
    const number = digits.slice(1)
    return `${number.slice(0, 3)}-${number.slice(3, 6)}-${number.slice(6)}`
  } else if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  return phone
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')

  // Valid US phone numbers are 10 digits or 11 digits starting with 1
  if (digits.length === 10) return true
  if (digits.length === 11 && digits[0] === '1') return true

  return false
}

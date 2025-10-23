import { Device, Call } from '@twilio/voice-sdk'

/**
 * Initiate an outbound call using Twilio Device
 * @param twilioDevice - Twilio Device instance
 * @param toPhoneNumber - Phone number to call
 * @param contactName - Optional contact name for display
 * @returns Promise<Call> - The active call instance
 */
export async function initiateOutboundCall(
  twilioDevice: Device,
  toPhoneNumber: string,
  contactName?: string
): Promise<Call> {
  if (!twilioDevice) {
    throw new Error('Twilio Device not initialized')
  }

  // Format phone number for Twilio (remove formatting)
  const formattedPhone = formatPhoneForTwilio(toPhoneNumber)

  try {
    const call = await twilioDevice.connect({
      params: {
        To: formattedPhone,
        ...(contactName && { contactName })
      }
    })

    console.log(`Initiated call to ${formattedPhone}${contactName ? ` (${contactName})` : ''}`)
    return call
  } catch (error) {
    console.error('Failed to initiate outbound call:', error)
    throw new Error('Failed to connect call')
  }
}

/**
 * Format phone number for Twilio (E.164 or US format)
 * Removes all formatting and ensures proper format
 * @param phone - Phone number in any format
 * @returns Formatted phone number
 */
export function formatPhoneForTwilio(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')

  // If starts with 1 and has 11 digits, it's already in E.164 format (for US)
  if (digits.length === 11 && digits[0] === '1') {
    return `+${digits}`
  }

  // If 10 digits, assume US number and add +1
  if (digits.length === 10) {
    return `+1${digits}`
  }

  // If already has + prefix, return as is
  if (phone.startsWith('+')) {
    return phone
  }

  // Default: add + prefix
  return `+${digits}`
}

/**
 * Format phone number for display (xxx-xxx-xxxx format)
 * @param phone - Phone number to format
 * @returns Formatted phone number string
 */
export function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '')

  // US phone number with country code
  if (digits.length === 11 && digits[0] === '1') {
    const number = digits.slice(1)
    return `${number.slice(0, 3)}-${number.slice(3, 6)}-${number.slice(6)}`
  }

  // US phone number without country code
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  // International or other formats
  return phone.replace('+', '')
}

/**
 * Format call duration in seconds to MM:SS format
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export function formatCallDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) {
    return 'N/A'
  }

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format date/time for call history display
 * @param dateString - ISO date string
 * @returns Formatted date string
 */
export function formatCallDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Validate phone number format
 * @param phone - Phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')

  // Accept 10 or 11 digits (US format)
  if (digits.length === 10 || (digits.length === 11 && digits[0] === '1')) {
    return true
  }

  // Accept international format with + prefix
  if (phone.startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return true
  }

  return false
}

/**
 * Get call direction based on contact phone and call numbers
 * @param contactPhone - Contact's phone number
 * @param fromNumber - Call from_number
 * @param toNumber - Call to_number
 * @returns 'inbound' or 'outbound'
 */
export function getCallDirection(
  contactPhone: string,
  fromNumber: string,
  toNumber: string
): 'inbound' | 'outbound' {
  // Normalize phone numbers for comparison
  const normalizePhone = (phone: string) => phone.replace(/\D/g, '')

  const normalizedContact = normalizePhone(contactPhone)
  const normalizedFrom = normalizePhone(fromNumber)
  const normalizedTo = normalizePhone(toNumber)

  // If contact phone matches from_number, it was an inbound call
  if (normalizedFrom.includes(normalizedContact) || normalizedContact.includes(normalizedFrom)) {
    return 'inbound'
  }

  // If contact phone matches to_number, it was an outbound call
  if (normalizedTo.includes(normalizedContact) || normalizedContact.includes(normalizedTo)) {
    return 'outbound'
  }

  // Default to outbound if unclear
  return 'outbound'
}

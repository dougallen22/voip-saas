/**
 * Twilio Device Hook
 *
 * This hook now uses the global TwilioDeviceContext provider.
 * The Device is initialized once at the app level and persists across page navigation.
 *
 * IMPORTANT: Calls will NO LONGER disconnect when navigating between pages!
 *
 * Migration: No code changes needed - this hook re-exports the context hook.
 */

export { useTwilioDevice } from '@/lib/context/TwilioDeviceContext'

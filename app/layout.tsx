import type { Metadata } from 'next'
import './globals.css'
import { TwilioDeviceProvider } from '@/lib/context/TwilioDeviceContext'

export const metadata: Metadata = {
  title: 'VoIP CRM SaaS',
  description: 'VoIP CRM calling application with Supabase and Twilio',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <TwilioDeviceProvider>
          {children}
        </TwilioDeviceProvider>
      </body>
    </html>
  )
}

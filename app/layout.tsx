import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}

import LoginForm from '@/components/auth/LoginForm'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6">
      <Link href="/" className="text-2xl font-bold text-slate-900 mb-8">
        VoIP CRM
      </Link>
      <LoginForm />
    </div>
  )
}

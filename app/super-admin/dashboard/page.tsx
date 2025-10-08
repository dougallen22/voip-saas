import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signOut } from '@/lib/auth/actions'
import OrganizationList from '@/components/super-admin/OrganizationList'
import CreateOrganizationButton from '@/components/super-admin/CreateOrganizationButton'

export default async function SuperAdminDashboard() {
  const supabase = await createClient()

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Use admin client to bypass RLS for checking role
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Check if user is super admin
  const { data: voipUser } = await adminClient
    .from('voip_users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!voipUser || voipUser.role !== 'super_admin') {
    redirect('/dashboard')
  }

  // Get all organizations
  const { data: organizations } = await adminClient
    .from('organizations')
    .select('*, voip_users(count)')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Super Admin Dashboard</h1>
              <p className="text-sm text-slate-600">Manage all organizations and tenants</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/super-admin/calling"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm"
              >
                📞 Calling Dashboard
              </Link>
              <span className="text-sm text-slate-600">{user.email}</span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-sm text-slate-600 hover:text-slate-900 font-medium"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-slate-600 mb-1">Total Organizations</div>
            <div className="text-3xl font-bold text-slate-900">{organizations?.length || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-slate-600 mb-1">Active Calls</div>
            <div className="text-3xl font-bold text-slate-900">0</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-slate-600 mb-1">Total Users</div>
            <div className="text-3xl font-bold text-slate-900">
              {organizations?.reduce((acc, org: any) => acc + (org.voip_users?.[0]?.count || 0), 0)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-sm text-slate-600 mb-1">Calls Today</div>
            <div className="text-3xl font-bold text-slate-900">0</div>
          </div>
        </div>

        {/* Organizations Section */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900">Organizations</h2>
            <CreateOrganizationButton />
          </div>
          <OrganizationList organizations={organizations || []} />
        </div>
      </main>
    </div>
  )
}

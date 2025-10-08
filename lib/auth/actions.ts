'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // User will be created in voip_users via trigger
  return { success: true, data }
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Get user role from voip_users
  const { data: voipUser } = await supabase
    .from('voip_users')
    .select('role, organization_id')
    .eq('id', data.user.id)
    .single()

  if (!voipUser) {
    return { error: 'User profile not found' }
  }

  // Redirect based on role
  if (voipUser.role === 'super_admin') {
    redirect('/super-admin/dashboard')
  } else {
    redirect('/dashboard')
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getCurrentUser() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Get full user profile
  const { data: voipUser } = await supabase
    .from('voip_users')
    .select('*, organizations(name)')
    .eq('id', user.id)
    .single()

  return {
    ...user,
    voipUser,
  }
}

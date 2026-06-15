import { redirect } from 'next/navigation'

import { AuthForm } from '@/components/auth-form'
import { getSession, isAuthenticated } from '@/lib/auth/session'

/** Página pública de registro (auth nativo). */
export default async function RegistroPage() {
  const session = await getSession()
  if (isAuthenticated(session)) redirect('/panel')
  return <AuthForm mode="register" />
}

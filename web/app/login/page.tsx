import { redirect } from 'next/navigation'

import { AuthForm } from '@/components/auth-form'
import { getSession, isAuthenticated } from '@/lib/auth/session'

/** Página pública de inicio de sesión (auth nativo). */
export default async function LoginPage() {
  const session = await getSession()
  if (isAuthenticated(session)) redirect('/panel')
  return <AuthForm mode="login" />
}

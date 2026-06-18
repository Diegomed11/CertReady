import { redirect } from 'next/navigation'

import { AuthForm } from '@/components/auth-form'
import { usaCognito } from '@/lib/auth/mode'
import { getSession, isAuthenticated } from '@/lib/auth/session'

/**
 * Página pública de inicio de sesión. Con el emisor local muestra el formulario
 * nativo; con Cognito redirige al flujo de redirección gestionado (Hosted UI).
 */
export default async function LoginPage() {
  const session = await getSession()
  if (isAuthenticated(session)) redirect('/panel')
  if (usaCognito()) redirect('/api/auth/login')
  return <AuthForm mode="login" />
}

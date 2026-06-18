import { redirect } from 'next/navigation'

import { AuthForm } from '@/components/auth-form'
import { usaCognito } from '@/lib/auth/mode'
import { getSession, isAuthenticated } from '@/lib/auth/session'

/**
 * Página pública de registro. Con el emisor local muestra el formulario nativo;
 * con Cognito redirige a su página gestionada (que incluye "crear cuenta").
 */
export default async function RegistroPage() {
  const session = await getSession()
  if (isAuthenticated(session)) redirect('/panel')
  if (usaCognito()) redirect('/api/auth/login')
  return <AuthForm mode="register" />
}

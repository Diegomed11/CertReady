/**
 * Guard de sesión para Server Components y layouts.
 *
 * `requireSession` redirige al inicio de sesión si la petición no está
 * autenticada; si lo está, devuelve la identidad ya estrechada (sin opcionales),
 * de modo que las páginas obtienen `subject` y `accessToken` como `string`.
 */
import { redirect } from 'next/navigation'

import { getSession } from './session'

/** Identidad autenticada con los campos garantizados no nulos. */
export interface AuthedSession {
  subject: string
  accessToken: string
  email: string | undefined
  nombre: string | undefined
  roles: string[]
}

/**
 * requireSession exige una sesión válida.
 *
 * Returns la identidad autenticada. Si no hay sesión válida, redirige a
 * `/login` (la página de inicio de sesión nativa; no retorna: `redirect` lanza).
 */
export async function requireSession(): Promise<AuthedSession> {
  const s = await getSession()
  if (!s.subject || !s.accessToken) {
    redirect('/login')
  }
  return {
    subject: s.subject,
    accessToken: s.accessToken,
    email: s.email,
    nombre: s.nombre,
    roles: s.roles ?? [],
  }
}

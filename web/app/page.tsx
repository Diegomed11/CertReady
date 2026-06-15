import { Landing } from '@/components/landing/landing'
import { getSession, isAuthenticated } from '@/lib/auth/session'

/** Portada pública. Presenta la plataforma y enruta al panel o al inicio de sesión. */
export default async function HomePage() {
  const session = await getSession()
  const autenticado = isAuthenticated(session)
  const ctaHref = autenticado ? '/panel' : '/registro'
  const accesoHref = autenticado ? '/panel' : '/login'
  const accesoText = autenticado ? 'Panel' : 'Iniciar sesión'

  return <Landing ctaHref={ctaHref} accesoHref={accesoHref} accesoText={accesoText} />
}

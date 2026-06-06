import { NavBar } from '@/components/nav-bar'
import { requireSession } from '@/lib/auth/guard'

/**
 * Layout de las rutas autenticadas. Exige sesión válida (redirige a login si no
 * la hay) y monta la barra de navegación común. Todas las páginas bajo este
 * grupo quedan protegidas.
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  return (
    <div className="min-h-screen">
      <NavBar email={session.email} />
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}

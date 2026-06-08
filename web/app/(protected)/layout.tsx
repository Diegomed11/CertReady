import { NavBar } from '@/components/nav-bar'
import { Container } from '@/components/ui/container'
import { requireSession } from '@/lib/auth/guard'

/**
 * Layout de las rutas autenticadas. Exige sesión válida (redirige a login si no
 * la hay) y monta el masthead común.
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar email={session.email} />
      <main className="flex-1 py-12">
        <Container>{children}</Container>
      </main>
      <footer className="border-t border-line">
        <Container className="py-6 font-mono text-xs text-faint">
          CertReady · Todos los derechos reservados
        </Container>
      </footer>
    </div>
  )
}

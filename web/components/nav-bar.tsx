import Link from 'next/link'

import { Container } from '@/components/ui/container'

import { LogoutButton } from './logout-button'

/**
 * NavBar es la barra superior de las páginas autenticadas. Componente de servidor
 * que recibe el email a mostrar e incluye el botón de logout (cliente).
 */
export function NavBar({ email }: { email: string | undefined }) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-line bg-white/90 backdrop-blur">
      <Container className="flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-8">
          <Link href="/panel" className="text-gradient-brand font-display text-2xl font-bold">
            CertReady
          </Link>
          <nav className="hidden gap-6 text-sm font-semibold text-muted sm:flex">
            <Link href="/panel" className="transition-colors hover:text-brand">
              Panel
            </Link>
            <Link href="/certifications" className="transition-colors hover:text-brand">
              Catálogo
            </Link>
            <Link href="/estudiar" className="transition-colors hover:text-brand">
              Estudiar
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {email ? <span className="hidden text-sm text-faint sm:inline">{email}</span> : null}
          <LogoutButton />
        </div>
      </Container>
    </header>
  )
}

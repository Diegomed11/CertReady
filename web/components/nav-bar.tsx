import Link from 'next/link'

import { Container } from '@/components/ui/container'

import { LogoutButton } from './logout-button'
import { MobileMenu } from './mobile-menu'

/** Enlaces principales de la app autenticada (orden de uso del estudiante). */
export const NAV_LINKS: { href: string; label: string }[] = [
  { href: '/panel', label: 'Panel' },
  { href: '/estudiar', label: 'Estudiar' },
  { href: '/examenes', label: 'Exámenes' },
  { href: '/entrevistas', label: 'Entrevistas' },
  { href: '/progreso', label: 'Progreso' },
  { href: '/certifications', label: 'Catálogo' },
]

/**
 * NavBar es la barra superior de las páginas autenticadas. Componente de servidor
 * que recibe el email a mostrar. En pantallas grandes los enlaces van en línea; en
 * móvil se pliegan en un menú desplegable (MobileMenu, cliente).
 */
export function NavBar({ email }: { email: string | undefined }) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-line bg-white/90 backdrop-blur">
      <Container className="flex items-center justify-between gap-4 py-3">
        <div className="flex items-center gap-8">
          <Link href="/panel" className="text-gradient-brand font-display text-2xl font-bold">
            CertReady
          </Link>
          <nav className="hidden gap-6 text-sm font-semibold text-muted lg:flex">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-brand">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {email ? <span className="hidden text-sm text-faint xl:inline">{email}</span> : null}
          <div className="hidden lg:block">
            <LogoutButton />
          </div>
          <MobileMenu links={NAV_LINKS} email={email} />
        </div>
      </Container>
    </header>
  )
}

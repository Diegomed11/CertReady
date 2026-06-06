import Link from 'next/link'

import { LogoutButton } from './logout-button'

/**
 * NavBar es la barra superior de las páginas autenticadas. Es un componente de
 * servidor que recibe el email a mostrar e incluye el botón de logout (cliente).
 */
export function NavBar({ email }: { email: string | undefined }) {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/panel" className="text-lg font-semibold">
            CertReady
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link
              href="/panel"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Panel
            </Link>
            <Link
              href="/certifications"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              Certificaciones
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {email ? <span className="hidden text-sm text-slate-500 sm:inline">{email}</span> : null}
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}

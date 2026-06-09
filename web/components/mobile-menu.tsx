'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { LogoutButton } from './logout-button'

/**
 * MobileMenu es el menú de navegación plegable para pantallas pequeñas (oculto en
 * `lg`). Un botón "hamburguesa" abre/cierra un panel con los enlaces. Se cierra al
 * cambiar de ruta para no quedar abierto tras navegar.
 */
export function MobileMenu({
  links,
  email,
}: {
  links: { href: string; label: string }[]
  email: string | undefined
}) {
  const [abierto, setAbierto] = useState(false)
  const pathname = usePathname()

  // Cierra el menú cuando cambia la ruta (tras pulsar un enlace).
  useEffect(() => {
    setAbierto(false)
  }, [pathname])

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-line-strong text-ink transition-colors hover:border-brand hover:text-brand"
      >
        <span className="text-xl leading-none">{abierto ? '✕' : '☰'}</span>
      </button>

      {abierto ? (
        <div className="absolute inset-x-0 top-full border-b-2 border-line bg-white shadow-lg">
          <nav className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-6 py-4 sm:px-8">
            {links.map((l) => {
              const activo = pathname === l.href || pathname.startsWith(`${l.href}/`)
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    activo
                      ? 'bg-brand/10 text-brand'
                      : 'text-muted hover:bg-sunken hover:text-brand'
                  }`}
                >
                  {l.label}
                </Link>
              )
            })}
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
              {email ? <span className="truncate text-xs text-faint">{email}</span> : <span />}
              <LogoutButton />
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  )
}

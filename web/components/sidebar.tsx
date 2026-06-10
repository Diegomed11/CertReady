'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

/** Navegación principal de la app autenticada (sidebar tipo app). */
const NAV = [
  { href: '/panel', label: 'Panel', icon: '/icons/house.png' },
  { href: '/estudiar', label: 'Estudiar', icon: '/icons/open-book.png' },
  { href: '/examenes', label: 'Exámenes', icon: '/icons/memo.png' },
  { href: '/entrevistas', label: 'Entrevistas', icon: '/icons/laptop.png' },
  { href: '/progreso', label: 'Progreso', icon: '/icons/chart.png' },
  { href: '/certifications', label: 'Catálogo', icon: '/icons/books.png' },
]

/** esActivo marca el item cuya sección corresponde a la ruta actual. */
function esActivo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Sidebar es la navegación lateral de las páginas autenticadas (estilo app). En
 * pantallas anchas muestra iconos + etiquetas y el usuario al pie; en estrechas se
 * colapsa a una columna de solo iconos. El item activo se resuelve por la ruta.
 */
export function Sidebar({ nombre, email }: { nombre?: string; email?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [saliendo, setSaliendo] = useState(false)
  const inicial = (nombre?.trim()?.[0] ?? email?.trim()?.[0] ?? 'U').toUpperCase()

  async function salir() {
    setSaliendo(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/')
      router.refresh()
    } finally {
      setSaliendo(false)
    }
  }

  return (
    <aside className="flex h-screen flex-col overflow-y-auto border-r-2 border-line bg-bg px-2 py-5 md:px-3.5">
      <Link
        href="/panel"
        className="block px-1 pb-5 pt-1.5 text-center font-display text-[22px] font-bold md:px-3 md:text-left md:text-[26px]"
      >
        <span className="text-gradient-brand md:hidden">CR</span>
        <span className="text-gradient-brand hidden md:inline">CertReady</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1.5">
        {NAV.map((n) => {
          const activo = esActivo(pathname, n.href)
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={activo ? 'page' : undefined}
              className={`flex w-full items-center justify-center gap-3.5 rounded-[14px] border-2 px-2 py-2.5 font-display text-sm font-semibold uppercase tracking-[0.08em] transition-colors md:justify-start md:px-3 ${
                activo
                  ? 'border-brand/55 bg-brand/[0.08] text-brand'
                  : 'border-transparent text-muted hover:bg-surface hover:text-ink'
              }`}
            >
              <Image
                src={n.icon}
                alt=""
                width={30}
                height={30}
                className="h-[30px] w-[30px] flex-none object-contain"
                draggable={false}
              />
              <span className="hidden md:inline">{n.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-3 flex items-center gap-2.5 border-t-2 border-line p-1 md:p-3">
        <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 font-display font-semibold text-white">
          {inicial}
        </div>
        <div className="hidden min-w-0 flex-1 md:block">
          {nombre ? <div className="text-[13px] font-bold text-ink">{nombre}</div> : null}
          {email ? (
            <div className="truncate font-mono text-[10.5px] text-faint">{email}</div>
          ) : null}
        </div>
        <button
          onClick={salir}
          disabled={saliendo}
          title="Cerrar sesión"
          className="hidden rounded-lg px-1.5 py-1 text-xs font-bold text-faint hover:bg-bad/10 hover:text-bad md:block"
        >
          {saliendo ? '…' : 'Salir'}
        </button>
      </div>
    </aside>
  )
}

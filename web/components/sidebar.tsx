'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/** Navegación principal de la app autenticada. */
const NAV = [
  { href: '/panel', label: 'Panel', icon: '/icons/house.png' },
  { href: '/estudiar', label: 'Estudiar', icon: '/icons/open-book.png' },
  { href: '/examenes', label: 'Exámenes', icon: '/icons/memo.png' },
  { href: '/entrevistas', label: 'Entrevistas', icon: '/icons/laptop.png' },
  { href: '/progreso', label: 'Progreso', icon: '/icons/chart.png' },
  { href: '/preparacion', label: 'Preparación', icon: '/icons/rocket.png' },
  { href: '/recomendaciones', label: 'Mi camino', icon: '/icons/target.png' },
  { href: '/certifications', label: 'Catálogo', icon: '/icons/books.png' },
]

function esActivo(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Sidebar — menú lateral colapsable (liquid glass). El logo CertReady y el toggle
 * quedan fijos; la nav + perfil + Salir se revelan/retraen con un clip circular y
 * entrada escalonada (WAAPI). Arranca abierto.
 */
export function Sidebar({
  nombre,
  email,
  esAdmin = false,
}: {
  nombre?: string
  email?: string
  esAdmin?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const navRef = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const inicial = (nombre?.trim()?.[0] ?? email?.trim()?.[0] ?? 'U').toUpperCase()

  const items = esAdmin
    ? [...NAV, { href: '/admin', label: 'Admin', icon: '/icons/bullseye-cal.png' }]
    : NAV

  // Revela el menú al montar (una vez; el layout persiste entre navegaciones).
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Entrada/salida escalonada de los ítems (WAAPI, independiente del re-render).
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const its = Array.from(nav.querySelectorAll<HTMLElement>('.side-item'))
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      its.forEach((it) => {
        it.style.opacity = '1'
        it.style.transform = 'none'
      })
      return
    }
    its.forEach((it, i) => {
      const order = open ? i : its.length - 1 - i
      it.getAnimations().forEach((a) => a.cancel())
      it.animate(
        open
          ? [
              { opacity: 0, transform: 'translateY(16px)' },
              { opacity: 1, transform: 'translateY(0)' },
            ]
          : [
              { opacity: 1, transform: 'translateY(0)' },
              { opacity: 0, transform: 'translateY(16px)' },
            ],
        {
          duration: 460,
          delay: 160 + order * 60,
          easing: 'cubic-bezier(.2,.8,.2,1)',
          fill: 'both',
        },
      )
    })
  }, [open, items.length])

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
    <aside className={'sidebar' + (open ? ' menu-open' : ' menu-closed')}>
      <div className="side-head">
        <button
          className={'menu-toggle' + (open ? ' open' : '')}
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={open}
        >
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </button>
        <Link href="/panel" className="logo text-gradient-brand">
          CertReady
        </Link>
      </div>

      <div className="menu-panel">
        <nav className="side-nav" ref={navRef}>
          {items.map((n) => {
            const activo = esActivo(pathname, n.href)
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={activo ? 'page' : undefined}
                className={'side-item' + (activo ? ' active' : '')}
              >
                <Image src={n.icon} alt="" width={33} height={33} draggable={false} />
                <span className="lbl">{n.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="side-user">
          <Link
            href="/perfil"
            title="Tu perfil"
            aria-current={esActivo(pathname, '/perfil') ? 'page' : undefined}
            className={'user-link' + (esActivo(pathname, '/perfil') ? ' active' : '')}
          >
            <div className="avatar">{inicial}</div>
            <div className="who">
              {nombre ? <div className="name">{nombre}</div> : null}
              {email ? <div className="mail">{email}</div> : null}
            </div>
          </Link>
          <button className="logout" onClick={salir} disabled={saliendo} title="Cerrar sesión">
            <span className="sign">
              <svg viewBox="0 0 512 512" aria-hidden="true">
                <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z" />
              </svg>
            </span>
            <span className="text">{saliendo ? '…' : 'Salir'}</span>
          </button>
        </div>
      </div>
    </aside>
  )
}

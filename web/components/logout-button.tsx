'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * LogoutButton cierra la sesión llamando a la ruta del BFF y vuelve al inicio.
 * Es un componente de cliente porque necesita manejar el clic y navegar.
 */
export function LogoutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function logout() {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {loading ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  )
}

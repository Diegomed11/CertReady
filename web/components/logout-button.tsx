'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { buttonStyles } from '@/components/ui/button'

/**
 * LogoutButton cierra la sesión llamando a la ruta del BFF y vuelve al inicio.
 * Es un componente de cliente porque maneja el clic y navega.
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
    <button onClick={logout} disabled={loading} className={buttonStyles('ghost', 'sm')}>
      {loading ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  )
}

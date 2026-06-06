'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * UnenrollButton elimina una inscripción propia llamando a la ruta del BFF y
 * refresca el panel (re-ejecuta el Server Component que lista las inscripciones).
 */
export function UnenrollButton({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function unenroll() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/enrollments/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        setError(true)
        return
      }
      router.refresh()
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={unenroll}
      disabled={loading}
      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      title={error ? 'No se pudo eliminar' : undefined}
    >
      {loading ? 'Eliminando…' : error ? 'Reintentar' : 'Darme de baja'}
    </button>
  )
}

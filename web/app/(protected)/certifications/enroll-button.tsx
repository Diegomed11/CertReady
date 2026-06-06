'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * EnrollButton inscribe al usuario en una certificación llamando a la ruta del
 * BFF y refresca la vista. Si ya está inscrito, muestra un indicador en vez del
 * botón.
 */
export function EnrollButton({ certId, enrolled }: { certId: string; enrolled: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (enrolled) {
    return (
      <span className="inline-flex w-fit items-center rounded-md bg-green-100 px-3 py-1.5 text-sm font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
        Inscrito
      </span>
    )
  }

  async function enroll() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tipo_objetivo: 'certificacion', objetivo_id: certId }),
      })
      if (!res.ok) {
        setError('No se pudo inscribir')
        return
      }
      router.refresh()
    } catch {
      setError('No se pudo inscribir')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={enroll}
        disabled={loading}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        {loading ? 'Inscribiendo…' : 'Inscribirme'}
      </button>
      {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </div>
  )
}

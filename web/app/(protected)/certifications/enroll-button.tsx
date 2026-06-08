'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'

/**
 * EnrollButton inscribe al usuario en una certificación llamando a la ruta del
 * BFF y refresca la vista. Si ya está inscrito, muestra un indicador.
 */
export function EnrollButton({ certId, enrolled }: { certId: string; enrolled: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (enrolled) {
    return <Badge tone="good">✓ Inscrito</Badge>
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
    <div className="flex items-center gap-3">
      <button onClick={enroll} disabled={loading} className={buttonStyles('primary', 'sm')}>
        {loading ? 'Inscribiendo…' : 'Inscribirme'}
      </button>
      {error ? <span className="text-sm font-semibold text-bad">{error}</span> : null}
    </div>
  )
}

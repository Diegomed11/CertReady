'use client'

import { useState } from 'react'

/**
 * MarkRead marca una lección como leída (registra el progreso en el backend). Es
 * idempotente; una vez leída, muestra el estado y no vuelve a llamar.
 */
export function MarkRead({
  cert,
  tema,
  materialId,
  leida,
}: {
  cert: string
  tema: string
  materialId: string
  leida: boolean
}) {
  const [done, setDone] = useState(leida)
  const [loading, setLoading] = useState(false)

  async function marcar() {
    if (done || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/progress/lessons', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ certificacion: cert, tema, material_id: materialId }),
      })
      if (res.ok) setDone(true)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <span className="shrink-0 rounded-full bg-good/15 px-3 py-1 text-xs font-bold text-good">
        ✓ Leída
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={marcar}
      disabled={loading}
      className="shrink-0 rounded-full border-2 border-line-strong px-3 py-1 text-xs font-bold text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
    >
      {loading ? '…' : 'Marcar leída'}
    </button>
  )
}

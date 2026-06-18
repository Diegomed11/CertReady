'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'

/** Opciones de autoevaluación (deben coincidir con el backend: nivel 1–3). */
const NIVELES: { nivel: number; etiqueta: string; tono: string }[] = [
  { nivel: 1, etiqueta: 'Me costó', tono: 'border-bad/40 text-bad hover:bg-bad/10' },
  { nivel: 2, etiqueta: 'Regular', tono: 'border-warn/50 text-warn hover:bg-warn/10' },
  { nivel: 3, etiqueta: 'Bien', tono: 'border-good/50 text-good hover:bg-good/10' },
]

/**
 * Reveal oculta la respuesta modelo tras un botón para fomentar el autoestudio:
 * el estudiante intenta responder primero y luego la compara con la solución. Tras
 * revelarla, registra una autoevaluación (1=me costó · 2=regular · 3=bien) que
 * alimenta la señal de Q&A del DSS de preparación por puesto.
 */
export function Reveal({
  respuesta,
  qaRef,
  area,
}: {
  respuesta: string
  qaRef: string
  area?: string
}) {
  const [visible, setVisible] = useState(false)
  const [nivel, setNivel] = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(false)

  async function autoevaluar(n: number) {
    setEnviando(true)
    setError(false)
    try {
      const res = await fetch('/api/progress/qa', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ qa_ref: qaRef, nivel: n, area }),
      })
      if (!res.ok) throw new Error('no se pudo guardar')
      setNivel(n)
    } catch {
      setError(true)
    } finally {
      setEnviando(false)
    }
  }

  if (!visible) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-line-strong bg-surface p-8 text-center">
        <p className="text-sm text-muted">Primero intenta responder tú. Cuando estés listo:</p>
        <div className="mt-4">
          <Button onClick={() => setVisible(true)}>Ver respuesta modelo</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-line bg-white p-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand">
          Respuesta modelo
        </p>
        <Markdown>{respuesta}</Markdown>
      </div>

      <div className="rounded-2xl border-2 border-line bg-surface p-6">
        <p className="text-sm font-semibold text-ink">
          ¿Qué tal te fue comparado con la respuesta?
        </p>
        <p className="mt-1 text-xs text-muted">
          Tu autoevaluación mide tu preparación para entrevistas por puesto.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {NIVELES.map((o) => {
            const sel = nivel === o.nivel
            return (
              <button
                key={o.nivel}
                onClick={() => autoevaluar(o.nivel)}
                disabled={enviando}
                aria-pressed={sel}
                className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  sel ? 'border-brand bg-brand/10 text-brand' : o.tono
                }`}
              >
                {o.etiqueta}
              </button>
            )
          })}
        </div>
        {nivel !== null && !error ? (
          <p className="mt-3 text-xs font-semibold text-good">
            ✓ Autoevaluación guardada. Puedes cambiarla cuando quieras.
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 text-xs font-semibold text-bad">
            No se pudo guardar. Revisa tu sesión e inténtalo de nuevo.
          </p>
        ) : null}
      </div>
    </div>
  )
}

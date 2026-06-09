'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'

/**
 * Reveal oculta la respuesta modelo tras un botón para fomentar el autoestudio:
 * el estudiante intenta responder primero y luego la compara con la solución.
 */
export function Reveal({ respuesta }: { respuesta: string }) {
  const [visible, setVisible] = useState(false)

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
    <div className="rounded-2xl border-2 border-line bg-white p-6">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand">Respuesta modelo</p>
      <Markdown>{respuesta}</Markdown>
    </div>
  )
}

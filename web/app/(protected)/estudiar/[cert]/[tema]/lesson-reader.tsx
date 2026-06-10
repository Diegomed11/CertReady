'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Markdown } from '@/components/ui/markdown'
import type { Material } from '@/lib/api/types'

import { MarkRead } from './mark-read'

/**
 * LessonReader presenta el material de un tema como un cuadernillo de "hojas": una
 * lección a la vez, con navegación anterior/siguiente e indicador de página. Cada
 * hoja se puede marcar como leída por separado. Las hojas se ordenan por su id
 * (el seed las numera: `m_<tema>`, `m_<tema>_2`, …).
 */
export function LessonReader({
  cert,
  tema,
  lecciones,
  leidasIds,
}: {
  cert: string
  tema: string
  lecciones: Material[]
  leidasIds: string[]
}) {
  const paginas = useMemo(
    () => [...lecciones].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    [lecciones],
  )
  const leidas = useMemo(() => new Set(leidasIds), [leidasIds])
  const [i, setI] = useState(0)

  const total = paginas.length
  if (total === 0) return null
  const idx = Math.min(i, total - 1)
  const m = paginas[idx]!

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {total > 1 ? (
            <p className="text-xs font-bold uppercase tracking-wide text-faint">
              Hoja {idx + 1} de {total}
            </p>
          ) : null}
          <h2 className="font-display text-xl font-semibold sm:text-2xl">{m.titulo}</h2>
        </div>
        <MarkRead cert={cert} tema={tema} materialId={m.id} leida={leidas.has(m.id)} />
      </div>

      <div className="mt-4">
        <Markdown>{m.contenido}</Markdown>
      </div>

      {total > 1 ? (
        <div className="mt-7 flex items-center justify-between gap-3 border-t-2 border-line pt-5">
          <Button
            variant="ghost"
            size="sm"
            disabled={idx === 0}
            onClick={() => setI(Math.max(0, idx - 1))}
          >
            ← Hoja anterior
          </Button>
          <div className="flex items-center gap-1.5" aria-hidden>
            {paginas.map((p, k) => (
              <span
                key={p.id}
                className={`h-2 w-2 rounded-full transition-colors ${
                  k === idx ? 'bg-brand' : 'bg-line-strong'
                }`}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={idx === total - 1}
            onClick={() => setI(Math.min(total - 1, idx + 1))}
          >
            Siguiente hoja →
          </Button>
        </div>
      ) : null}
    </Card>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getQA } from '@/lib/api/services'
import { requireSession } from '@/lib/auth/guard'

import { Reveal } from './reveal'

/** Detalle de una pregunta de Q&A: enunciado, puntos clave y respuesta modelo. */
export default async function PreguntaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession()
  const { id } = await params
  const q = await getQA(id)
  if (!q) notFound()

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link href="/entrevistas/preguntas" className={buttonStyles('quiet', 'sm')}>
        ← Volver a preguntas
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          {q.puesto ? <Badge tone="brand">{q.puesto}</Badge> : null}
          <Badge tone="neutral">{q.area}</Badge>
          {q.categoria ? <Badge tone="neutral">{q.categoria}</Badge> : null}
          {q.tipo ? <Badge tone="neutral">{q.tipo}</Badge> : null}
        </div>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {q.enunciado}
        </h1>
      </header>

      {q.puntos_clave.length > 0 ? (
        <Card className="p-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand">Puntos clave</p>
          <ul className="space-y-1.5">
            {q.puntos_clave.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink">
                <span className="text-brand">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {q.respuesta_modelo ? <Reveal respuesta={q.respuesta_modelo} /> : null}

      {q.etiquetas.length > 0 ? (
        <p className="font-mono text-xs text-faint">{q.etiquetas.map((e) => `#${e}`).join('  ')}</p>
      ) : null}
    </article>
  )
}

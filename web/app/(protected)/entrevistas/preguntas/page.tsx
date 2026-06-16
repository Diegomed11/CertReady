import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { listPuestos, listQA } from '@/lib/api/services'
import { requireSession } from '@/lib/auth/guard'

function chipCls(sel: boolean): string {
  return `rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors ${
    sel ? 'border-brand bg-brand/10 text-brand' : 'border-line-strong text-muted hover:border-brand'
  }`
}

function areaChipCls(sel: boolean): string {
  return `rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
    sel ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:border-brand'
  }`
}

/**
 * Banco de Q&A de entrevista, navegable por **especialidad** o por **área**. Una
 * especialidad filtra por sus áreas (que pueden compartirse entre especialidades),
 * así que la misma pregunta puede aparecer en varias.
 */
export default async function PreguntasPage({
  searchParams,
}: {
  searchParams: Promise<{ especialidad?: string; area?: string }>
}) {
  await requireSession()
  const sp = await searchParams
  const puestos = await listPuestos()

  const esp = puestos.find((p) => p.slug === sp.especialidad)
  const preguntas = await listQA({
    areas: esp ? esp.qa_areas : undefined, // especialidad → sus áreas ($in)
    area: !esp ? sp.area : undefined, // o un área puntual
    limit: 100,
  })

  const areas = Array.from(new Set(puestos.flatMap((p) => p.qa_areas))).sort()

  return (
    <div className="space-y-8">
      <PageHeader
        label={<SectionLabel>Entrevistas · Q&A</SectionLabel>}
        title="Preguntas frecuentes"
        lead="Elige una especialidad o un área y repasa preguntas con respuesta modelo y puntos clave. Una misma pregunta puede aparecer en varias especialidades."
      />

      {puestos.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Link href="/entrevistas/preguntas" className={chipCls(!esp && !sp.area)}>
              Todas
            </Link>
            {puestos.map((p) => (
              <Link
                key={p.slug}
                href={`/entrevistas/preguntas?especialidad=${encodeURIComponent(p.slug)}`}
                className={chipCls(esp?.slug === p.slug)}
              >
                {p.nombre}
              </Link>
            ))}
          </div>
          {areas.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-bold uppercase tracking-wide text-faint">
                o por área:
              </span>
              {areas.map((a) => (
                <Link
                  key={a}
                  href={`/entrevistas/preguntas?area=${encodeURIComponent(a)}`}
                  className={areaChipCls(!esp && sp.area === a)}
                >
                  {a}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {preguntas.data.length === 0 ? (
        <EmptyState title="No hay preguntas con ese filtro">
          Prueba con otra especialidad o área, o vuelve más tarde.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {preguntas.data.map((q) => (
            <li key={q.id}>
              <Link href={`/entrevistas/preguntas/${q.id}`} className="block">
                <Card interactive className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{q.area}</Badge>
                    {q.categoria ? <Badge tone="neutral">{q.categoria}</Badge> : null}
                  </div>
                  <h2 className="mt-3 font-display text-lg font-semibold text-ink">
                    {q.enunciado}
                  </h2>
                  <span className="mt-3 inline-block text-sm font-bold text-brand">Ver →</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

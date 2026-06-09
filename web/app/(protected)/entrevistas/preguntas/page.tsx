import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { listQA } from '@/lib/api/services'
import { requireSession } from '@/lib/auth/guard'

/** Banco de preguntas de Q&A de entrevista, con filtros por puesto/área/categoría. */
export default async function PreguntasPage({
  searchParams,
}: {
  searchParams: Promise<{ puesto?: string; area?: string; categoria?: string }>
}) {
  await requireSession()
  const sp = await searchParams
  const preguntas = await listQA({
    puesto: sp.puesto,
    area: sp.area,
    categoria: sp.categoria,
    limit: 100,
  })

  return (
    <div className="space-y-8">
      <PageHeader
        label={<SectionLabel>Entrevistas · Q&A</SectionLabel>}
        title="Preguntas frecuentes"
        lead="Repasa preguntas conceptuales y de comportamiento, con respuesta modelo y puntos clave."
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        {[
          { name: 'puesto', label: 'Puesto', ph: 'p. ej. backend' },
          { name: 'area', label: 'Área', ph: 'p. ej. sistemas' },
          { name: 'categoria', label: 'Categoría', ph: 'p. ej. concurrencia' },
        ].map((f) => (
          <label key={f.name} className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
              {f.label}
            </span>
            <input
              name={f.name}
              defaultValue={(sp as Record<string, string | undefined>)[f.name] ?? ''}
              placeholder={f.ph}
              className="rounded-xl border-2 border-line-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
          </label>
        ))}
        <button type="submit" className={buttonStyles('ghost', 'sm')}>
          Filtrar
        </button>
        {sp.puesto || sp.area || sp.categoria ? (
          <Link href="/entrevistas/preguntas" className={buttonStyles('quiet', 'sm')}>
            Limpiar
          </Link>
        ) : null}
      </form>

      {preguntas.data.length === 0 ? (
        <EmptyState title="No hay preguntas con esos filtros">
          Prueba a quitar los filtros o vuelve más tarde.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {preguntas.data.map((q) => (
            <li key={q.id}>
              <Link href={`/entrevistas/preguntas/${q.id}`} className="block">
                <Card interactive className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {q.puesto ? <Badge tone="brand">{q.puesto}</Badge> : null}
                    <Badge tone="neutral">{q.area}</Badge>
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

import Link from 'next/link'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { listProblems } from '@/lib/api/services'
import type { Dificultad } from '@/lib/api/types'
import { requireSession } from '@/lib/auth/guard'

function dificultadTone(d: string): BadgeTone {
  if (d === 'facil') return 'good'
  if (d === 'media') return 'warn'
  return 'bad'
}

const DIFICULTADES: { valor: Dificultad; etiqueta: string }[] = [
  { valor: 'facil', etiqueta: 'Fácil' },
  { valor: 'media', etiqueta: 'Media' },
  { valor: 'dificil', etiqueta: 'Difícil' },
]

/** Listado de problemas de código con filtros por dificultad y área. */
export default async function ProblemasPage({
  searchParams,
}: {
  searchParams: Promise<{ dificultad?: string; area?: string }>
}) {
  await requireSession()
  const sp = await searchParams
  const problemas = await listProblems({
    dificultad: sp.dificultad,
    area: sp.area,
    limit: 100,
  })

  return (
    <div className="space-y-8">
      <PageHeader
        label={<SectionLabel>Entrevistas · Código</SectionLabel>}
        title="Problemas de código"
        lead="Elige un reto, escribe tu solución y ejecútala contra el juez."
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
            Dificultad
          </span>
          <select
            name="dificultad"
            defaultValue={sp.dificultad ?? ''}
            className="rounded-xl border-2 border-line-strong bg-white px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand"
          >
            <option value="">Todas</option>
            {DIFICULTADES.map((d) => (
              <option key={d.valor} value={d.valor}>
                {d.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
            Área
          </span>
          <input
            name="area"
            defaultValue={sp.area ?? ''}
            placeholder="p. ej. algoritmos"
            className="rounded-xl border-2 border-line-strong bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
        </label>
        <button type="submit" className={buttonStyles('ghost', 'sm')}>
          Filtrar
        </button>
        {sp.dificultad || sp.area ? (
          <Link href="/entrevistas/problemas" className={buttonStyles('quiet', 'sm')}>
            Limpiar
          </Link>
        ) : null}
      </form>

      {problemas.data.length === 0 ? (
        <EmptyState title="No hay problemas con esos filtros">
          Prueba a quitar los filtros o vuelve más tarde: estamos sumando retos.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {problemas.data.map((p) => (
            <li key={p.id}>
              <Link href={`/entrevistas/problemas/${p.id}`} className="block h-full">
                <Card interactive className="flex h-full flex-col p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={dificultadTone(p.dificultad)}>{p.dificultad}</Badge>
                    <Badge tone="neutral">{p.area}</Badge>
                  </div>
                  <h2 className="mt-3 font-display text-xl font-semibold">{p.titulo}</h2>
                  {p.etiquetas.length > 0 ? (
                    <p className="mt-3 font-mono text-xs text-faint">
                      {p.etiquetas.map((e) => `#${e}`).join('  ')}
                    </p>
                  ) : null}
                  <span className="mt-4 text-sm font-bold text-brand">Resolver →</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

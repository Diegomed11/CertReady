import Link from 'next/link'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { listProblems, listPuestos } from '@/lib/api/services'
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

type SP = { dificultad?: string; especialidad?: string; area?: string }

/** Construye un href de la página fusionando los filtros actuales con un cambio. */
function href(sp: SP, patch: Partial<SP>): string {
  const merged: SP = { ...sp, ...patch }
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v)
  const s = qs.toString()
  return `/entrevistas/problemas${s ? `?${s}` : ''}`
}

function chipCls(sel: boolean): string {
  return `rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors ${
    sel ? 'border-brand bg-brand/10 text-brand' : 'border-line-strong text-muted hover:border-brand'
  }`
}

function smChipCls(sel: boolean): string {
  return `rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
    sel ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:border-brand'
  }`
}

/**
 * Problemas de código, navegables por **especialidad** o **área**, y por
 * dificultad. Elegir una especialidad filtra por sus áreas de código.
 */
export default async function ProblemasPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSession()
  const sp = await searchParams
  const puestos = await listPuestos()

  const esp = puestos.find((p) => p.slug === sp.especialidad)
  const problemas = await listProblems({
    dificultad: sp.dificultad,
    areas: esp ? esp.code_areas : undefined,
    area: !esp ? sp.area : undefined,
    limit: 100,
  })

  const areas = Array.from(new Set(puestos.flatMap((p) => p.code_areas))).sort()

  return (
    <div className="space-y-8">
      <PageHeader
        label={<SectionLabel>Entrevistas · Código</SectionLabel>}
        title="Problemas de código"
        lead="Elige una especialidad o un área, escribe tu solución y ejecútala contra el juez."
      />

      <div className="space-y-3">
        {/* Especialidad / área */}
        {puestos.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Link
                href={href(sp, { especialidad: undefined, area: undefined })}
                className={chipCls(!esp && !sp.area)}
              >
                Todas
              </Link>
              {puestos.map((p) => (
                <Link
                  key={p.slug}
                  href={href(sp, { especialidad: p.slug, area: undefined })}
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
                    href={href(sp, { area: a, especialidad: undefined })}
                    className={smChipCls(!esp && sp.area === a)}
                  >
                    {a}
                  </Link>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {/* Dificultad (combina con lo anterior) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-bold uppercase tracking-wide text-faint">
            dificultad:
          </span>
          <Link href={href(sp, { dificultad: undefined })} className={smChipCls(!sp.dificultad)}>
            Todas
          </Link>
          {DIFICULTADES.map((d) => (
            <Link
              key={d.valor}
              href={href(sp, { dificultad: d.valor })}
              className={smChipCls(sp.dificultad === d.valor)}
            >
              {d.etiqueta}
            </Link>
          ))}
        </div>
      </div>

      {problemas.data.length === 0 ? (
        <EmptyState title="No hay problemas con esos filtros">
          Prueba a quitar algún filtro o vuelve más tarde: estamos sumando retos.
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

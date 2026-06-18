import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Gauge } from '@/components/ui/gauge'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { getJobReadiness, listPuestos } from '@/lib/api/services'
import type { JobReadiness, SenalPreparacion } from '@/lib/api/types'
import { requireSession } from '@/lib/auth/guard'

function barColor(pct: number): string {
  return pct >= 70 ? 'bg-good' : pct >= 40 ? 'bg-warn' : 'bg-bad'
}

function nivelTono(nivel: string): 'good' | 'warn' | 'brand' | 'neutral' {
  if (nivel === 'Listo') return 'good'
  if (nivel === 'Sólido') return 'brand'
  if (nivel === 'En progreso') return 'warn'
  return 'neutral'
}

/**
 * Preparación por puesto: combina tres señales —exámenes (readiness IRT), código
 * (problemas resueltos) y Q&A (autoevaluación)— en una estimación de qué tan listo
 * está el usuario para un rol. El DSS es opcional; si no está disponible se degrada
 * con claridad (no rompe la app).
 */
export default async function PreparacionPage({
  searchParams,
}: {
  searchParams: Promise<{ puesto?: string }>
}) {
  const { accessToken } = await requireSession()
  const sp = await searchParams
  const puestos = await listPuestos()

  const activo = puestos.find((p) => p.slug === sp.puesto) ?? puestos[0]
  const datos = activo ? await getJobReadiness(accessToken, activo.slug) : null

  return (
    <div className="space-y-8">
      <PageHeader
        label={<SectionLabel>Preparación por puesto</SectionLabel>}
        title="¿Qué tan listo estás?"
        lead="Estimamos tu preparación para un puesto combinando tus simulacros, los problemas de código que resuelves y tu autoevaluación en preguntas de entrevista."
      />

      {puestos.length === 0 ? (
        <EmptyState title="El análisis por puesto no está disponible">
          El servicio de análisis (DSS) no respondió. Inténtalo de nuevo más tarde.
        </EmptyState>
      ) : (
        <>
          {puestos.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {puestos.map((p) => {
                const sel = p.slug === activo?.slug
                return (
                  <Link
                    key={p.slug}
                    href={`/preparacion?puesto=${encodeURIComponent(p.slug)}`}
                    className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors ${
                      sel
                        ? 'border-brand bg-brand/10 text-brand'
                        : 'border-line-strong text-muted hover:border-brand'
                    }`}
                  >
                    {p.nombre}
                  </Link>
                )
              })}
            </div>
          )}

          {activo ? <PuestoDetalle activo={activo} datos={datos} /> : null}
        </>
      )}
    </div>
  )
}

/** Muestra la readiness combinada y el desglose por señal del puesto activo. */
function PuestoDetalle({
  activo,
  datos,
}: {
  activo: { slug: string; nombre: string; descripcion: string }
  datos: JobReadiness | null
}) {
  const combinada = datos?.readiness_pct ?? null

  return (
    <>
      <div className="grid items-stretch gap-5 md:grid-cols-3">
        <Card beam className="flex flex-col items-center justify-center p-6">
          {combinada !== null ? (
            <Gauge value={combinada} etiqueta="Preparación" />
          ) : (
            <div className="flex h-[168px] w-[168px] items-center justify-center rounded-full border-[14px] border-sunken text-center">
              <span className="px-4 text-xs font-semibold uppercase tracking-wide text-faint">
                Sin datos
              </span>
            </div>
          )}
          {datos ? (
            <Badge tone={nivelTono(datos.nivel)} className="mt-4">
              {datos.nivel}
            </Badge>
          ) : null}
        </Card>

        <Card beam className="flex flex-col justify-center p-6 md:col-span-2">
          <h2 className="font-display text-lg font-semibold">{activo.nombre}</h2>
          <p className="mt-1 text-sm text-muted">{activo.descripcion}</p>
          {datos?.enfoque ? (
            <p className="mt-4 text-sm text-muted">
              Dónde enfocarte ahora: <span className="font-semibold text-ink">{datos.enfoque}</span>{' '}
              — es la señal con menor avance hoy.
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Aún no hay datos para este puesto. Haz un simulacro, resuelve problemas de código y
              autoevalúa preguntas de entrevista para verlo crecer.
            </p>
          )}
        </Card>
      </div>

      {datos ? (
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">Desglose por señal</h2>
          <p className="mt-1 text-sm text-muted">
            Cada señal aporta según su peso para este puesto. Las señales sin datos no cuentan en el
            total.
          </p>
          <div className="mt-5 space-y-5">
            {datos.senales.map((s) => (
              <Senal key={s.clave} senal={s} />
            ))}
          </div>
        </Card>
      ) : null}
    </>
  )
}

/** Una barra de señal: etiqueta, peso, score (o "sin datos") y detalle. */
function Senal({ senal }: { senal: SenalPreparacion }) {
  const pct = senal.score_pct
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-semibold text-ink">
          {senal.etiqueta}
          <Badge tone="neutral">peso {Math.round(senal.peso * 100)}%</Badge>
        </span>
        <span className="font-mono text-xs text-muted">
          {pct !== null ? `${Math.round(pct)}%` : 'sin datos'} · {senal.detalle}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-sunken">
        {pct !== null ? (
          <div
            className={`h-full rounded-full ${barColor(pct)}`}
            style={{ width: `${Math.max(3, pct)}%` }}
          />
        ) : null}
      </div>
    </div>
  )
}

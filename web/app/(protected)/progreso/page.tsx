import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Gauge } from '@/components/ui/gauge'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { getReadiness, listCertifications, listMyEnrollments } from '@/lib/api/services'
import type { CeldaDominio } from '@/lib/api/types'
import { requireSession } from '@/lib/auth/guard'

function nivelColor(pct: number): string {
  return pct >= 70 ? 'bg-good' : pct >= 40 ? 'bg-warn' : 'bg-bad'
}

/** Barra de dominio de una celda (tema · dificultad). */
function BarraDominio({ celda }: { celda: CeldaDominio }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-ink">
          {celda.tema} <span className="font-normal text-faint">· {celda.dificultad}</span>
        </span>
        <span className="font-mono text-xs text-muted">
          {Math.round(celda.dominio_pct)}% · {celda.intentos} intento
          {celda.intentos === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-sunken">
        <div
          className={`h-full rounded-full ${nivelColor(celda.dominio_pct)}`}
          style={{ width: `${Math.max(3, Math.min(100, celda.dominio_pct))}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Progreso: estima la preparación del estudiante (DSS, IRT Rasch) para la
 * certificación elegida. La readiness es una estimación que mejora con cada
 * simulacro; si no hay intentos todavía, invita a hacer uno.
 */
export default async function ProgresoPage({
  searchParams,
}: {
  searchParams: Promise<{ cert?: string }>
}) {
  const { accessToken, subject } = await requireSession()
  const sp = await searchParams
  const [inscripciones, certs] = await Promise.all([
    listMyEnrollments(accessToken),
    listCertifications({ accessToken, limit: 100 }),
  ])

  const certsById = new Map(certs.data.map((c) => [c.id, c]))
  // La readiness se consulta por slug (clave de las preguntas/intentos), no por UUID.
  const opciones = inscripciones.data
    .filter((i) => i.tipo_objetivo === 'certificacion')
    .flatMap((i) => {
      const c = certsById.get(i.objetivo_id)
      return c ? [{ id: c.slug, nombre: c.nombre }] : []
    })

  const certActiva = sp.cert && opciones.some((o) => o.id === sp.cert) ? sp.cert : opciones[0]?.id
  const readiness = certActiva ? await getReadiness(subject, certActiva) : null

  return (
    <div className="space-y-8">
      <PageHeader
        label={<SectionLabel>Progreso</SectionLabel>}
        title="Tu preparación"
        lead="Una estimación de qué tan listo estás, calibrada con tus simulacros. Mejora a medida que practicas."
      />

      {opciones.length === 0 ? (
        <EmptyState title="Primero inscríbete en una certificación">
          Elige un objetivo en el{' '}
          <Link href="/certifications" className="font-semibold text-brand">
            catálogo
          </Link>{' '}
          y haz un simulacro para ver tu preparación.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {opciones.map((o) => {
              const activa = o.id === certActiva
              return (
                <Link
                  key={o.id}
                  href={`/progreso?cert=${encodeURIComponent(o.id)}`}
                  className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors ${
                    activa
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-line-strong text-muted hover:border-brand'
                  }`}
                >
                  {o.nombre}
                </Link>
              )
            })}
          </div>

          {!readiness ? (
            <EmptyState title="Aún no hay datos para esta certificación">
              Haz un{' '}
              <Link href="/examenes" className="font-semibold text-brand">
                simulacro
              </Link>{' '}
              y vuelve: con tus respuestas estimaremos tu preparación.
            </EmptyState>
          ) : (
            <div className="space-y-6">
              <div className="grid items-stretch gap-5 md:grid-cols-3">
                <Card className="flex flex-col items-center justify-center p-6">
                  <Gauge value={readiness.readiness_pct} etiqueta="Preparación" />
                </Card>

                <Card className="flex flex-col justify-center p-6">
                  <p className="text-xs font-bold uppercase tracking-wide text-faint">
                    Probabilidad de aprobar
                  </p>
                  <p className="mt-1 font-display text-4xl font-bold text-brand">
                    {Math.round(readiness.probabilidad_aprobar * 100)}
                    <span className="text-xl text-faint">%</span>
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Estimación para un examen estándar a partir de tu desempeño.
                  </p>
                </Card>

                <Card className="flex flex-col justify-center p-6">
                  <p className="text-xs font-bold uppercase tracking-wide text-faint">
                    Siguiente mejor paso
                  </p>
                  {readiness.siguiente_accion ? (
                    <>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone="brand">{readiness.siguiente_accion.tema}</Badge>
                        <Badge tone="neutral">{readiness.siguiente_accion.dificultad}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted">{readiness.siguiente_accion.motivo}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      ¡Vas muy bien! Sigue practicando para mantener el nivel.
                    </p>
                  )}
                </Card>
              </div>

              <Card className="p-6">
                <h2 className="font-display text-lg font-semibold">Dominio por tema</h2>
                <p className="mt-1 text-sm text-muted">
                  Tu nivel estimado en cada combinación de tema y dificultad.
                </p>
                <div className="mt-5 space-y-4">
                  {[...readiness.por_celda]
                    .sort((a, b) => a.dominio_pct - b.dominio_pct)
                    .map((celda) => (
                      <BarraDominio key={`${celda.tema}-${celda.dificultad}`} celda={celda} />
                    ))}
                </div>
              </Card>

              <p className="text-center font-mono text-xs text-faint">
                Estimación IRT Rasch · habilidad θ = {readiness.habilidad_theta.toFixed(2)}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

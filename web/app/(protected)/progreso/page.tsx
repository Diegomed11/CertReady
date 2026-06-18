import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { CtaLink } from '@/components/ui/cta'
import { EmptyState } from '@/components/ui/empty-state'
import { Gauge } from '@/components/ui/gauge'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import {
  getAnalytics,
  getMyProgress,
  getReadiness,
  listCertifications,
  listMyEnrollments,
  listMyExams,
  listTopics,
} from '@/lib/api/services'
import type { SesionExamen, Tema } from '@/lib/api/types'
import { requireSession } from '@/lib/auth/guard'

/** Umbral de aprobación del examen real SAA-C03 (720/1000 ≈ 72%). */
const APROBADO_PCT = 72

function nivelColor(pct: number): string {
  return pct >= APROBADO_PCT ? 'bg-good' : pct >= 50 ? 'bg-warn' : 'bg-bad'
}

/** Resumen de un dominio: cuántos de sus temas tienen el quiz aprobado. */
interface ResumenDominio {
  nombre: string
  total: number
  aprobados: number
}

/** agrupaPorDominio cuenta los temas aprobados por dominio, en el orden del temario. */
function agrupaPorDominio(temas: Tema[], aprobados: Set<string>): ResumenDominio[] {
  const orden: string[] = []
  const por = new Map<string, ResumenDominio>()
  for (const t of temas) {
    const d = t.dominio ?? 'General'
    let r = por.get(d)
    if (!r) {
      r = { nombre: d, total: 0, aprobados: 0 }
      por.set(d, r)
      orden.push(d)
    }
    r.total++
    if (aprobados.has(t.slug)) r.aprobados++
  }
  return orden.map((d) => por.get(d)!)
}

/**
 * Progreso: el avance real del estudiante en una certificación. Combina el
 * progreso de estudio (temas con quiz aprobado) y los simulacros entregados, que
 * persisten en los servicios `progress` y `exams`. La estimación IRT (servicio
 * DSS) se muestra solo si está disponible; no es requisito para ver el avance.
 */
export default async function ProgresoPage({
  searchParams,
}: {
  searchParams: Promise<{ cert?: string }>
}) {
  const { accessToken } = await requireSession()
  const sp = await searchParams
  const [inscripciones, certs] = await Promise.all([
    listMyEnrollments(accessToken),
    listCertifications({ accessToken, limit: 100 }),
  ])

  const certsById = new Map(certs.data.map((c) => [c.id, c]))
  // El progreso/examenes se consultan por slug (clave legible), no por UUID; pero
  // los temas del catálogo se piden por el id de la certificación.
  const opciones = inscripciones.data
    .filter((i) => i.tipo_objetivo === 'certificacion')
    .flatMap((i) => {
      const c = certsById.get(i.objetivo_id)
      return c ? [{ slug: c.slug, id: c.id, nombre: c.nombre }] : []
    })

  const activa = opciones.find((o) => o.slug === sp.cert) ?? opciones[0]

  return (
    <div className="space-y-8">
      <PageHeader
        label={<SectionLabel>Progreso</SectionLabel>}
        title="Tu avance"
        lead="Lo que llevas estudiado y cómo te ha ido en los simulacros. Se actualiza con cada tema y cada examen."
      />

      {!activa ? (
        <EmptyState title="Primero inscríbete en una certificación">
          Elige un objetivo en el{' '}
          <Link href="/certifications" className="font-semibold text-brand">
            catálogo
          </Link>{' '}
          para empezar a ver tu avance.
        </EmptyState>
      ) : (
        <ProgresoCert activa={activa} opciones={opciones} accessToken={accessToken} />
      )}
    </div>
  )
}

/** ProgresoCert carga y muestra el avance de la certificación seleccionada. */
async function ProgresoCert({
  activa,
  opciones,
  accessToken,
}: {
  activa: { slug: string; id: string; nombre: string }
  opciones: { slug: string; id: string; nombre: string }[]
  accessToken: string
}) {
  const [progreso, temas, historial, readiness, analitica] = await Promise.all([
    getMyProgress(accessToken, activa.slug),
    listTopics(activa.id, accessToken),
    listMyExams(accessToken, { limit: 100 }),
    getReadiness(accessToken, activa.slug), // opcional: null si el servicio no está disponible
    getAnalytics(accessToken, activa.slug), // opcional: null si el servicio no está disponible
  ])

  const aprobadosSet = new Set(progreso.temas.filter((t) => t.quiz_aprobado).map((t) => t.tema))
  const totalTemas = temas.length
  const temasAprobados = temas.filter((t) => aprobadosSet.has(t.slug)).length
  const pctEstudio = totalTemas > 0 ? Math.round((temasAprobados / totalTemas) * 100) : 0
  const dominios = agrupaPorDominio(temas, aprobadosSet)

  // Simulacros entregados de esta certificación (el historial viene de más reciente
  // a más antiguo). Los puntajes están en escala 0–100.
  const finalizados = historial.data.filter(
    (s: SesionExamen) =>
      s.modo === 'simulacro' &&
      s.certificacion === activa.slug &&
      s.estado === 'finalizada' &&
      s.puntaje !== null,
  )
  const enCurso = historial.data.filter(
    (s: SesionExamen) =>
      s.modo === 'simulacro' && s.certificacion === activa.slug && s.estado === 'en_curso',
  )
  const ultimo = finalizados[0]?.puntaje ?? null
  const mejor = finalizados.length > 0 ? Math.max(...finalizados.map((s) => s.puntaje ?? 0)) : null

  // Acierto por dominio en simulacros (de la analítica del DSS): mapea cada tema a
  // su dominio y agrega aciertos/total, en el orden del temario.
  const temaDominio = new Map(temas.map((t) => [t.slug, t.dominio ?? 'General']))
  const acumDominio = new Map<string, { aciertos: number; total: number }>()
  for (const pt of analitica?.por_tema ?? []) {
    const dom = temaDominio.get(pt.tema) ?? 'General'
    const cur = acumDominio.get(dom) ?? { aciertos: 0, total: 0 }
    cur.aciertos += pt.aciertos
    cur.total += pt.total
    acumDominio.set(dom, cur)
  }
  const aciertoDominio = dominios
    .map((d) => {
      const v = acumDominio.get(d.nombre) ?? { aciertos: 0, total: 0 }
      return {
        nombre: d.nombre,
        total: v.total,
        pct: v.total > 0 ? Math.round((v.aciertos / v.total) * 100) : 0,
      }
    })
    .filter((d) => d.total > 0)

  return (
    <>
      {opciones.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {opciones.map((o) => {
            const sel = o.slug === activa.slug
            return (
              <Link
                key={o.slug}
                href={`/progreso?cert=${encodeURIComponent(o.slug)}`}
                className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors ${
                  sel
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-line-strong text-muted hover:border-brand'
                }`}
              >
                {o.nombre}
              </Link>
            )
          })}
        </div>
      )}

      <div className="grid items-stretch gap-5 md:grid-cols-3">
        {/* Estudio */}
        <Card beam className="flex flex-col items-center justify-center p-6">
          <Gauge value={pctEstudio} etiqueta="Estudio" />
          <p className="mt-3 text-center text-sm text-muted">
            {temasAprobados} de {totalTemas} temas aprobados
          </p>
          <p className="mt-1 text-center text-xs text-faint">
            {progreso.lecciones.length} lección{progreso.lecciones.length === 1 ? '' : 'es'} leída
            {progreso.lecciones.length === 1 ? '' : 's'}
          </p>
        </Card>

        {/* Simulacros */}
        <Card beam className="flex flex-col justify-center p-6 md:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-faint">Simulacros</p>
            {mejor !== null && (
              <Badge tone={mejor >= APROBADO_PCT ? 'good' : 'warn'}>
                {mejor >= APROBADO_PCT ? 'Nivel de aprobado' : 'Aún no llegas al 72%'}
              </Badge>
            )}
          </div>

          {finalizados.length === 0 ? (
            <div className="mt-3">
              <p className="text-sm text-muted">
                Todavía no has entregado ningún simulacro de esta certificación.
              </p>
              <CtaLink href="/examenes" arrow className="mt-3">
                Hacer un simulacro
              </CtaLink>
            </div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-4">
                <div>
                  <p className="font-display text-3xl font-bold text-brand">
                    {Math.round(mejor ?? 0)}
                    <span className="text-lg text-faint">%</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">Mejor puntaje</p>
                </div>
                <div>
                  <p className="font-display text-3xl font-bold text-ink">
                    {Math.round(ultimo ?? 0)}
                    <span className="text-lg text-faint">%</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted">Último</p>
                </div>
                <div>
                  <p className="font-display text-3xl font-bold text-ink">{finalizados.length}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Entregado{finalizados.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-faint">
                Se aprueba con 72% (720/1000).{' '}
                {enCurso.length > 0 && (
                  <Link href="/examenes" className="font-semibold text-warn">
                    Tienes {enCurso.length} simulacro{enCurso.length === 1 ? '' : 's'} en curso →
                  </Link>
                )}
              </p>
            </>
          )}
        </Card>
      </div>

      {/* Avance por dominio */}
      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold">Avance por dominio</h2>
        <p className="mt-1 text-sm text-muted">
          Temas con el quiz aprobado en cada dominio del examen.
        </p>
        <div className="mt-5 space-y-4">
          {dominios.map((d) => {
            const pct = d.total > 0 ? Math.round((d.aprobados / d.total) * 100) : 0
            return (
              <div key={d.nombre}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">{d.nombre}</span>
                  <span className="font-mono text-xs text-muted">
                    {d.aprobados}/{d.total} temas
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-sunken">
                  <div
                    className={`h-full rounded-full ${nivelColor(pct)}`}
                    style={{ width: `${Math.max(3, pct)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Acierto por dominio en simulacros (dashboard de analítica del DSS) */}
      {aciertoDominio.length > 0 && (
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">Acierto por dominio</h2>
          <p className="mt-1 text-sm text-muted">
            Porcentaje de respuestas correctas en tus simulacros, por dominio del examen.
          </p>
          <div className="mt-5 space-y-4">
            {aciertoDominio.map((d) => (
              <div key={d.nombre}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">{d.nombre}</span>
                  <span className="font-mono text-xs text-muted">
                    {d.pct}% · {d.total} resp.
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-sunken">
                  <div
                    className={`h-full rounded-full ${nivelColor(d.pct)}`}
                    style={{ width: `${Math.max(3, d.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Estimación IRT (opcional, solo si el DSS está disponible) */}
      {readiness && (
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold">Preparación estimada</h2>
              <p className="mt-1 text-sm text-muted">
                Modelo estadístico (IRT Rasch) calibrado con tus simulacros.
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-3xl font-bold text-brand">
                {Math.round(readiness.probabilidad_aprobar * 100)}
                <span className="text-lg text-faint">%</span>
              </p>
              <p className="text-xs text-muted">Probabilidad de aprobar</p>
            </div>
          </div>
          {readiness.siguiente_accion && (
            <p className="mt-4 text-sm text-muted">
              Siguiente mejor paso:{' '}
              <span className="font-semibold text-ink">{readiness.siguiente_accion.tema}</span> —{' '}
              {readiness.siguiente_accion.motivo}
            </p>
          )}
        </Card>
      )}
    </>
  )
}

import { redirect } from 'next/navigation'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import {
  getBusinessAreas,
  getBusinessChurn,
  getBusinessOverview,
  listUsers,
} from '@/lib/api/services'
import type {
  BusinessAreas,
  BusinessChurn,
  BusinessOverview,
  EstadoTema,
  MesActividad,
  Usuario,
} from '@/lib/api/types'
import { requireSession } from '@/lib/auth/guard'

/** Color de barra según el porcentaje (mismo patrón que progreso/preparación). */
function barColor(pct: number): string {
  return pct >= 70 ? 'bg-good' : pct >= 40 ? 'bg-warn' : 'bg-bad'
}

/** Etiqueta y tono del estado de un tema (gaps de contenido). */
const ESTADO_TEMA: Record<EstadoTema, { texto: string; tono: BadgeTone }> = {
  ok: { texto: 'Equilibrado', tono: 'good' },
  facil: { texto: 'Muy fácil', tono: 'neutral' },
  dificil: { texto: 'Difícil', tono: 'bad' },
  poco_volumen: { texto: 'Poco volumen', tono: 'warn' },
}

/** Formatea un entero con separadores de miles (es-MX). */
function num(n: number): string {
  return new Intl.NumberFormat('es-MX').format(Math.round(n))
}

/**
 * Panel de administración: la vista de "decisiones de la plataforma". Consume la
 * analítica agregada del DSS (sin PII) y la muestra solo a administradores. El
 * gating reusa el mismo criterio del layout/sidebar: `roles.includes('admin')`;
 * si no es admin, redirige a /panel. El DSS es opcional: si los tres endpoints
 * caen, se muestra un estado vacío. Debajo se mantiene el padrón de usuarios.
 */
export default async function AdminPage() {
  const session = await requireSession()
  if (!session.roles.includes('admin')) {
    redirect('/panel')
  }

  // En SECUENCIA, no en paralelo: el DSS comparte un único cliente de ClickHouse
  // que no es seguro para consultas concurrentes; dispararlas a la vez hacía que
  // overview/churn chocaran y degradaran a ceros. El padrón de usuarios es de otro
  // servicio (users), así que ese sí puede ir aparte.
  const usuarios = await listUsers(session.accessToken, { limit: 100 })
  const overview = await getBusinessOverview()
  const areas = await getBusinessAreas()
  const churn = await getBusinessChurn()

  const sinDss = !overview && !areas && !churn

  return (
    <div className="space-y-8">
      <PageHeader
        label={<SectionLabel>Administración</SectionLabel>}
        title="Decisiones de la plataforma"
        lead="Analítica agregada de toda la plataforma: uso, dónde fallan los estudiantes y qué tan bien retenemos. Datos sin información personal, calculados por el DSS."
      />

      {sinDss ? (
        <EmptyState title="El servicio de análisis no está disponible">
          El DSS no respondió. Inténtalo de nuevo más tarde.
        </EmptyState>
      ) : (
        <>
          {overview ? <Kpis overview={overview} /> : null}
          {overview && overview.actividad_mensual.length > 0 ? (
            <ActividadMensual meses={overview.actividad_mensual} />
          ) : null}
          {areas ? <Oportunidades areas={areas} /> : null}
          {churn ? <Retencion churn={churn} /> : null}
        </>
      )}

      <Usuarios usuarios={usuarios.data} count={usuarios.count} />
    </div>
  )
}

/** Tarjetas de KPI: usuarios, exámenes, código y Q&A. */
function Kpis({ overview }: { overview: BusinessOverview }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-faint">Usuarios</p>
        <p className="mt-2 font-display text-3xl font-bold text-brand">{num(overview.usuarios)}</p>
        <p className="mt-1 text-xs text-muted">Total registrados</p>
      </Card>

      <Card className="p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-faint">Exámenes</p>
        <p className="mt-2 font-display text-3xl font-bold text-ink">
          {num(overview.examenes.intentos)}
        </p>
        <p className="mt-1 text-xs text-muted">
          Intentos · {Math.round(overview.examenes.acierto_pct)}% de acierto
        </p>
      </Card>

      <Card className="p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-faint">Código</p>
        <p className="mt-2 font-display text-3xl font-bold text-ink">
          {num(overview.codigo.ejecuciones)}
        </p>
        <p className="mt-1 text-xs text-muted">
          Ejecuciones · {Math.round(overview.codigo.aceptacion_pct)}% de aceptación
        </p>
      </Card>

      <Card className="p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-faint">Q&amp;A</p>
        <p className="mt-2 font-display text-3xl font-bold text-ink">
          {num(overview.qa.autoevaluaciones)}
        </p>
        <p className="mt-1 text-xs text-muted">
          Autoevaluaciones · {Math.round(overview.qa.nivel_promedio_pct)}% de nivel promedio
        </p>
      </Card>
    </div>
  )
}

/** Actividad mensual: barras simples (intentos, ejecuciones, Q&A) por mes. */
function ActividadMensual({ meses }: { meses: MesActividad[] }) {
  const max = Math.max(1, ...meses.flatMap((m) => [m.intentos, m.ejecuciones, m.qa]))
  const series = [
    { clave: 'intentos' as const, etiqueta: 'Intentos de examen', color: 'bg-brand' },
    { clave: 'ejecuciones' as const, etiqueta: 'Ejecuciones de código', color: 'bg-good' },
    { clave: 'qa' as const, etiqueta: 'Autoevaluaciones Q&A', color: 'bg-warn' },
  ]

  return (
    <Card className="p-6">
      <h2 className="font-display text-lg font-semibold">Actividad mensual</h2>
      <p className="mt-1 text-sm text-muted">
        Volumen de uso por mes. Cada mes compara intentos de examen, ejecuciones de código y
        autoevaluaciones de Q&amp;A.
      </p>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.clave} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
            {s.etiqueta}
          </span>
        ))}
      </div>
      <div className="mt-5 space-y-5">
        {meses.map((m) => (
          <div key={m.mes}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-ink">{m.mes}</span>
              <span className="font-mono text-xs text-muted">{num(m.usuarios)} usuarios</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {series.map((s) => {
                const v = m[s.clave]
                return (
                  <div key={s.clave} className="flex items-center gap-2">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-sunken">
                      <div
                        className={`h-full rounded-full ${s.color}`}
                        style={{ width: `${Math.max(2, (v / max) * 100)}%` }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right font-mono text-xs text-faint">
                      {num(v)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Temas con más oportunidad (gaps) + desglose de código y Q&A por área. */
function Oportunidades({ areas }: { areas: BusinessAreas }) {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold">Temas con más oportunidad</h2>
        <p className="mt-1 text-sm text-muted">
          Los 15 temas con menor acierto agregado: dónde más conviene reforzar contenido (los
          difíciles) o revisar el banco (los de poco volumen).
        </p>
        <div className="mt-5 space-y-4">
          {areas.examenes_por_tema.length === 0 ? (
            <p className="text-sm text-muted">Aún no hay datos de exámenes por tema.</p>
          ) : (
            areas.examenes_por_tema.slice(0, 15).map((t) => {
              const e = ESTADO_TEMA[t.estado]
              return (
                <div key={`${t.certificacion}-${t.tema}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      {t.tema}
                      <span className="text-xs font-normal text-faint">{t.certificacion}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone={e.tono}>{e.texto}</Badge>
                      <span className="font-mono text-xs text-muted">
                        {Math.round(t.acierto_pct)}% · {num(t.intentos)} intentos
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-sunken">
                    <div
                      className={`h-full rounded-full ${barColor(t.acierto_pct)}`}
                      style={{ width: `${Math.max(3, t.acierto_pct)}%` }}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">Código por área</h2>
          <p className="mt-1 text-sm text-muted">Aceptación de las ejecuciones por área.</p>
          <div className="mt-5 space-y-4">
            {areas.codigo_por_area.length === 0 ? (
              <p className="text-sm text-muted">Aún no hay datos de código por área.</p>
            ) : (
              areas.codigo_por_area.map((a) => (
                <div key={a.area}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-ink">{a.area}</span>
                    <span className="font-mono text-xs text-muted">
                      {Math.round(a.aceptacion_pct)}% · {num(a.ejecuciones)} ejec.
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-sunken">
                    <div
                      className={`h-full rounded-full ${barColor(a.aceptacion_pct)}`}
                      style={{ width: `${Math.max(3, a.aceptacion_pct)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">Q&amp;A por área</h2>
          <p className="mt-1 text-sm text-muted">Nivel promedio de autoevaluación por área.</p>
          <div className="mt-5 space-y-4">
            {areas.qa_por_area.length === 0 ? (
              <p className="text-sm text-muted">Aún no hay datos de Q&amp;A por área.</p>
            ) : (
              areas.qa_por_area.map((a) => (
                <div key={a.area}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-ink">{a.area}</span>
                    <span className="font-mono text-xs text-muted">
                      {Math.round(a.nivel_promedio_pct)}% · {num(a.autoevaluaciones)} autoeval.
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-sunken">
                    <div
                      className={`h-full rounded-full ${barColor(a.nivel_promedio_pct)}`}
                      style={{ width: `${Math.max(3, a.nivel_promedio_pct)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

/** Retención y abandono: números destacados + vida útil + activos por mes. */
function Retencion({ churn }: { churn: BusinessChurn }) {
  const maxVida = Math.max(1, ...churn.vida_util.map((v) => v.usuarios))
  const maxActivos = Math.max(1, ...churn.activos_por_mes.map((a) => a.usuarios))

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Card className="p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-faint">
            Días activo promedio
          </p>
          <p className="mt-2 font-display text-3xl font-bold text-brand">
            {churn.dias_activo_promedio.toFixed(1)}
          </p>
          <p className="mt-1 text-xs text-muted">Por usuario</p>
        </Card>
        <Card className="p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-faint">Abandono</p>
          <p className="mt-2 font-display text-3xl font-bold text-ink">
            {Math.round(churn.abandono_pct)}
            <span className="text-lg text-faint">%</span>
          </p>
          <p className="mt-1 text-xs text-muted">Usuarios que dejaron de usar la plataforma</p>
        </Card>
      </div>

      {churn.vida_util.length > 0 ? (
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">Vida útil</h2>
          <p className="mt-1 text-sm text-muted">
            Cuántos usuarios hay en cada rango de tiempo de uso.
          </p>
          <div className="mt-5 space-y-4">
            {churn.vida_util.map((v) => (
              <div key={v.rango}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">{v.rango}</span>
                  <span className="font-mono text-xs text-muted">{num(v.usuarios)} usuarios</span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-sunken">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.max(3, (v.usuarios / maxVida) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {churn.activos_por_mes.length > 0 ? (
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">Usuarios activos por mes</h2>
          <p className="mt-1 text-sm text-muted">
            Usuarios únicos que usaron la plataforma cada mes.
          </p>
          <div className="mt-5 space-y-4">
            {churn.activos_por_mes.map((a) => (
              <div key={a.mes}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold text-ink">{a.mes}</span>
                  <span className="font-mono text-xs text-muted">{num(a.usuarios)} usuarios</span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-sunken">
                  <div
                    className="h-full rounded-full bg-good"
                    style={{ width: `${Math.max(3, (a.usuarios / maxActivos) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  )
}

/** Padrón de usuarios (servicio users; el backend exige rol admin igualmente). */
function Usuarios({ usuarios, count }: { usuarios: Usuario[]; count: number }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b-2 border-line p-6">
        <h2 className="font-display text-lg font-semibold">Usuarios</h2>
        <p className="mt-1 text-sm text-muted">
          {count} {count === 1 ? 'usuario registrado' : 'usuarios registrados'}.
        </p>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-line bg-surface text-xs uppercase tracking-wide text-faint">
            <th className="px-6 py-3 font-semibold">Usuario</th>
            <th className="px-6 py-3 font-semibold">Rol</th>
            <th className="px-6 py-3 font-semibold">Alta</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u.id} className="border-b border-line last:border-0">
              <td className="px-6 py-3">
                <div className="font-semibold text-ink">{u.nombre ?? '—'}</div>
                <div className="font-mono text-[12px] text-faint">{u.email}</div>
              </td>
              <td className="px-6 py-3">
                <Badge tone={u.rol === 'admin' ? 'brand' : 'neutral'}>
                  {u.rol === 'admin' ? 'Admin' : 'Estudiante'}
                </Badge>
              </td>
              <td className="px-6 py-3 text-muted">
                {new Date(u.creado_en).toLocaleDateString('es', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </td>
            </tr>
          ))}
          {usuarios.length === 0 && (
            <tr>
              <td colSpan={3} className="px-6 py-10 text-center text-muted">
                Aún no hay usuarios.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  )
}

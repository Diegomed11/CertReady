import Link from 'next/link'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { listCertifications, listMyEnrollments, listMyExams } from '@/lib/api/services'
import type { EstadoSesion, SesionExamen } from '@/lib/api/types'
import { requireSession } from '@/lib/auth/guard'

import { StartExam } from './start-exam'

function estadoTone(estado: EstadoSesion): BadgeTone {
  return estado === 'finalizada' ? 'good' : 'warn'
}

function etiquetaEstado(estado: EstadoSesion): string {
  return estado === 'finalizada' ? 'Finalizado' : 'En curso'
}

/** Fecha legible (local) a partir de un ISO-8601. */
function fecha(iso: string): string {
  return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Exámenes: inicia un simulacro cronometrado y repasa tu historial. Las preguntas
 * se muestrean del banco; al entregar obtienes tu puntaje y el repaso con
 * explicaciones.
 */
export default async function ExamenesPage() {
  const { accessToken } = await requireSession()
  const [inscripciones, certs, historial] = await Promise.all([
    listMyEnrollments(accessToken),
    listCertifications({ accessToken, limit: 100 }),
    listMyExams(accessToken, { limit: 50 }),
  ])

  const certsById = new Map(certs.data.map((c) => [c.id, c]))
  const nombrePorSlug = new Map(certs.data.map((c) => [c.slug, c.nombre]))
  // El examen se identifica por slug (clave legible), no por el UUID de inscripción.
  const opciones = inscripciones.data
    .filter((i) => i.tipo_objetivo === 'certificacion')
    .flatMap((i) => {
      const c = certsById.get(i.objetivo_id)
      return c ? [{ id: c.slug, nombre: c.nombre }] : []
    })

  // Solo los simulacros van al historial; los quizzes de estudio (modo 'practica')
  // no se listan aquí.
  const simulacros = historial.data.filter((s) => s.modo === 'simulacro')

  return (
    <div className="space-y-10">
      <PageHeader
        label={<SectionLabel>Exámenes</SectionLabel>}
        title="Simulacros"
        lead="Practica con preguntas reales, cronométrate y repasa tus fallos con explicaciones."
      />

      <section>
        {opciones.length === 0 ? (
          <EmptyState title="Primero inscríbete en una certificación">
            Elige un objetivo en el{' '}
            <Link href="/certifications" className="font-semibold text-brand">
              catálogo
            </Link>{' '}
            para empezar a hacer simulacros.
          </EmptyState>
        ) : (
          <Card className="p-6">
            <h2 className="font-display text-xl font-semibold">Nuevo examen de práctica</h2>
            <p className="mt-1 text-sm text-muted">
              Un simulacro con el formato del examen real: preguntas de todos los dominios y
              desglose de tu desempeño por sección al terminar.
            </p>
            <div className="mt-5">
              <StartExam certificaciones={opciones} />
            </div>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-display text-xl font-semibold">Mi historial</h2>
        {simulacros.length === 0 ? (
          <EmptyState title="Aún no has hecho exámenes">
            Cuando entregues tu primer examen de práctica aparecerá aquí, con tu puntaje.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {simulacros.map((s: SesionExamen) => (
              <li key={s.id}>
                <Link href={`/examenes/${s.id}`} className="block">
                  <Card interactive className="flex items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-4">
                      <Badge tone={estadoTone(s.estado)}>{etiquetaEstado(s.estado)}</Badge>
                      <div>
                        <p className="font-semibold text-ink">
                          {nombrePorSlug.get(s.certificacion) ?? s.certificacion}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-faint">
                          {fecha(s.iniciado_en)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {s.puntaje !== null ? (
                        <span className="font-display text-2xl font-bold text-brand">
                          {Math.round(s.puntaje)}
                          <span className="text-sm text-faint">/100</span>
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-warn">Continuar →</span>
                      )}
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

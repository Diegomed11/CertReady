import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { getCertification, getMyProgress, listMyEnrollments, listTopics } from '@/lib/api/services'
import type { Certificacion } from '@/lib/api/types'
import { requireSession } from '@/lib/auth/guard'

interface Curso {
  cert: Certificacion
  total: number
  completados: number
}

/**
 * Estudiar: tus certificaciones inscritas como rutas de aprendizaje. Cada una
 * muestra su nombre y el progreso (temas completados). Sin UUIDs: la clave técnica
 * (slug) solo va en la URL.
 */
export default async function EstudiarPage() {
  const { accessToken } = await requireSession()
  const inscripciones = await listMyEnrollments(accessToken)
  const certIds = inscripciones.data
    .filter((i) => i.tipo_objetivo === 'certificacion')
    .map((i) => i.objetivo_id)

  const cursos = (
    await Promise.all(
      certIds.map(async (id): Promise<Curso | null> => {
        const cert = await getCertification(id, accessToken)
        if (!cert) return null
        const [temas, prog] = await Promise.all([
          listTopics(cert.id, accessToken),
          getMyProgress(accessToken, cert.slug),
        ])
        const completados = prog.temas.filter((t) => t.quiz_aprobado).length
        return { cert, total: temas.length, completados }
      }),
    )
  ).filter((c): c is Curso => c !== null)

  return (
    <div className="space-y-10">
      <PageHeader
        label={<SectionLabel>Estudiar</SectionLabel>}
        title="Tus rutas de aprendizaje"
        lead="Avanza tema por tema, a tu ritmo. Cada tema termina en un mini-quiz que desbloquea el siguiente."
      />

      {cursos.length === 0 ? (
        <EmptyState title="Aún no tienes rutas">
          Inscríbete en una certificación del{' '}
          <Link href="/certifications" className="font-semibold text-brand">
            catálogo
          </Link>{' '}
          para empezar a estudiar.
        </EmptyState>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {cursos.map(({ cert, total, completados }) => {
            const pct = total > 0 ? Math.round((completados / total) * 100) : 0
            return (
              <li key={cert.id}>
                <Link href={`/estudiar/${cert.slug}`} className="block h-full">
                  <Card beam interactive className="flex h-full flex-col p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{cert.proveedor}</Badge>
                      <Badge tone="neutral">{cert.nivel}</Badge>
                    </div>
                    <h2 className="mt-3 font-display text-xl font-semibold">{cert.nombre}</h2>
                    <div className="mt-auto pt-5">
                      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted">
                        <span>
                          {completados} de {total} temas
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-sunken">
                        <div
                          className="bg-gradient-brand h-full rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="mt-4 inline-block text-sm font-bold text-brand">
                        {completados === 0 ? 'Empezar →' : 'Continuar →'}
                      </span>
                    </div>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

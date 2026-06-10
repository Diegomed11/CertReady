import Link from 'next/link'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { getMe, listCertifications, listMyEnrollments } from '@/lib/api/services'
import type { EstadoInscripcion } from '@/lib/api/types'
import { requireSession } from '@/lib/auth/guard'

import { UnenrollButton } from './unenroll-button'

function estadoTone(estado: EstadoInscripcion): BadgeTone {
  if (estado === 'activa') return 'good'
  if (estado === 'completada') return 'brand'
  if (estado === 'pausada') return 'warn'
  return 'neutral'
}

/**
 * Panel del estudiante: datos de la cuenta e inscripciones. El primer acceso
 * provisiona la cuenta en el servicio users (vía getMe).
 */
export default async function PanelPage() {
  const { accessToken } = await requireSession()
  const [cuenta, inscripciones, certs] = await Promise.all([
    getMe(accessToken),
    listMyEnrollments(accessToken),
    listCertifications({ accessToken, limit: 100 }),
  ])
  const certsById = new Map(certs.data.map((c) => [c.id, c]))

  const accesos = [
    { href: '/estudiar', emoji: '📖', titulo: 'Estudiar' },
    { href: '/examenes', emoji: '📝', titulo: 'Simulacros' },
    { href: '/entrevistas', emoji: '💻', titulo: 'Entrevistas' },
    { href: '/progreso', emoji: '📊', titulo: 'Progreso' },
  ]

  return (
    <div className="space-y-10">
      <PageHeader
        label={<SectionLabel>Panel</SectionLabel>}
        title={`Hola${cuenta.nombre ? `, ${cuenta.nombre}` : ''} 👋`}
        lead={`${cuenta.email} · rol ${cuenta.rol}`}
      />

      <section>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {accesos.map((a) => (
            <li key={a.href}>
              <Link href={a.href} className="block h-full">
                <Card
                  interactive
                  className="flex h-full flex-col items-center gap-2 p-5 text-center"
                >
                  <span className="text-3xl">{a.emoji}</span>
                  <span className="font-display text-sm font-semibold text-ink">{a.titulo}</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Mis inscripciones</h2>
          <Link href="/certifications" className={buttonStyles('quiet', 'sm')}>
            Explorar catálogo →
          </Link>
        </div>

        {inscripciones.data.length === 0 ? (
          <EmptyState title="Aún no tienes inscripciones">
            Elige una certificación del catálogo para empezar tu ruta.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {inscripciones.data.map((ins) => {
              const cert = certsById.get(ins.objetivo_id)
              const nombre =
                cert?.nombre ??
                (ins.tipo_objetivo === 'pista' ? 'Pista de entrevista' : 'Certificación')
              return (
                <li key={ins.id}>
                  <Card className="flex items-center justify-between gap-4 p-4">
                    <div className="flex items-center gap-4">
                      {cert ? <Badge tone="brand">{cert.proveedor}</Badge> : null}
                      <div>
                        {cert ? (
                          <Link
                            href={`/estudiar/${cert.slug}`}
                            className="font-semibold text-ink hover:text-brand"
                          >
                            {nombre}
                          </Link>
                        ) : (
                          <p className="font-semibold text-ink">{nombre}</p>
                        )}
                        <p className="mt-1">
                          <Badge tone={estadoTone(ins.estado)}>{ins.estado}</Badge>
                        </p>
                      </div>
                    </div>
                    <UnenrollButton id={ins.id} />
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

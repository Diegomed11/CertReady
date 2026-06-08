import Link from 'next/link'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { getMe, listMyEnrollments } from '@/lib/api/services'
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
  const [cuenta, inscripciones] = await Promise.all([
    getMe(accessToken),
    listMyEnrollments(accessToken),
  ])

  return (
    <div className="space-y-10">
      <PageHeader
        label={<SectionLabel>Panel</SectionLabel>}
        title={`Hola${cuenta.nombre ? `, ${cuenta.nombre}` : ''} 👋`}
        lead={`${cuenta.email} · rol ${cuenta.rol}`}
      />

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
            {inscripciones.data.map((ins) => (
              <li key={ins.id}>
                <Card className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-4">
                    <Badge tone="brand">{ins.tipo_objetivo}</Badge>
                    <div>
                      <p className="font-semibold text-ink">{ins.objetivo_id}</p>
                      <p className="mt-1">
                        <Badge tone={estadoTone(ins.estado)}>{ins.estado}</Badge>
                      </p>
                    </div>
                  </div>
                  <UnenrollButton id={ins.id} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

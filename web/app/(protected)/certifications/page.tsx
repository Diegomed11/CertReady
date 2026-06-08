import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { listCertifications, listMyEnrollments } from '@/lib/api/services'
import { requireSession } from '@/lib/auth/guard'

import { EnrollButton } from './enroll-button'

/**
 * Catálogo de certificaciones. Lista las certificaciones (servicio catalog) y
 * marca cuáles ya tiene el usuario inscritas (servicio enrollments).
 */
export default async function CertificationsPage() {
  const { accessToken } = await requireSession()
  const [certs, mias] = await Promise.all([
    listCertifications({ accessToken, limit: 100 }),
    listMyEnrollments(accessToken),
  ])

  const inscritas = new Set(
    mias.data.filter((i) => i.tipo_objetivo === 'certificacion').map((i) => i.objetivo_id),
  )

  return (
    <div className="space-y-10">
      <PageHeader
        label={<SectionLabel>Catálogo</SectionLabel>}
        title="Certificaciones"
        lead="Elige tu objetivo. Te inscribes y empiezas a construir tu ruta."
      />

      {certs.data.length === 0 ? (
        <EmptyState title="El catálogo está vacío">
          Aún no hay certificaciones publicadas.
        </EmptyState>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {certs.data.map((cert) => (
            <li key={cert.id}>
              <Card className="flex h-full flex-col justify-between gap-6 p-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{cert.proveedor}</Badge>
                    <Badge tone="neutral">{cert.nivel}</Badge>
                  </div>
                  <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">
                    {cert.nombre}
                  </h2>
                  {cert.descripcion ? (
                    <p className="mt-2 text-sm leading-relaxed text-muted">{cert.descripcion}</p>
                  ) : null}
                </div>
                <EnrollButton certId={cert.id} enrolled={inscritas.has(cert.id)} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

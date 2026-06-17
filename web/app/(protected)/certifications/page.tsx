import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { listCertifications, listMyEnrollments } from '@/lib/api/services'
import type { Certificacion } from '@/lib/api/types'
import { requireSession } from '@/lib/auth/guard'

import { EnrollButton } from './enroll-button'

/**
 * Catálogo de certificaciones, agrupado por proveedor. Marca las inscritas (con
 * acceso directo a estudiar) y muestra cuántos temas tiene cada ruta.
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

  const porProveedor = new Map<string, Certificacion[]>()
  for (const c of certs.data) {
    const arr = porProveedor.get(c.proveedor) ?? []
    arr.push(c)
    porProveedor.set(c.proveedor, arr)
  }
  const grupos = [...porProveedor.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="space-y-10">
      <PageHeader
        label={<SectionLabel>Catálogo</SectionLabel>}
        title="Explora certificaciones"
        lead="Elige tu objetivo, inscríbete y construye tu ruta de estudio paso a paso."
      />

      {certs.data.length === 0 ? (
        <EmptyState title="El catálogo está vacío">
          Aún no hay certificaciones publicadas.
        </EmptyState>
      ) : (
        grupos.map(([proveedor, lista]) => (
          <section key={proveedor} className="space-y-4">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted">
              {proveedor}
            </h2>
            <ul className="grid gap-5 sm:grid-cols-2">
              {lista.map((cert) => {
                const inscrito = inscritas.has(cert.id)
                const temas = cert.num_temas ?? 0
                return (
                  <li key={cert.id}>
                    <Card className="flex h-full flex-col justify-between gap-5 p-6">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="neutral">{cert.nivel}</Badge>
                          {temas > 0 ? <Badge tone="brand">{temas} temas</Badge> : null}
                        </div>
                        <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight">
                          {cert.nombre}
                        </h3>
                        {cert.descripcion ? (
                          <p className="mt-2 text-sm leading-relaxed text-muted">
                            {cert.descripcion}
                          </p>
                        ) : null}
                      </div>
                      {inscrito ? (
                        <Link
                          href={`/estudiar/${cert.slug}`}
                          className={buttonStyles('primary', 'sm')}
                        >
                          Estudiar →
                        </Link>
                      ) : (
                        <EnrollButton certId={cert.id} enrolled={false} />
                      )}
                    </Card>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

import { listCertifications, listMyEnrollments } from '@/lib/api/services'
import { requireSession } from '@/lib/auth/guard'

import { EnrollButton } from './enroll-button'

/**
 * Catálogo de certificaciones. Lista las certificaciones (servicio catalog) y
 * marca cuáles ya tiene el usuario inscritas (servicio enrollments), para
 * ofrecer inscribirse en las restantes.
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Certificaciones</h1>

      {certs.data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">
          No hay certificaciones en el catálogo todavía.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {certs.data.map((cert) => (
            <li
              key={cert.id}
              className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {cert.proveedor}
                  </span>
                  <span className="text-xs text-slate-500">{cert.nivel}</span>
                </div>
                <h2 className="mt-2 font-semibold">{cert.nombre}</h2>
                {cert.descripcion ? (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {cert.descripcion}
                  </p>
                ) : null}
              </div>
              <EnrollButton certId={cert.id} enrolled={inscritas.has(cert.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

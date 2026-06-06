import Link from 'next/link'

import { getMe, listMyEnrollments } from '@/lib/api/services'
import { requireSession } from '@/lib/auth/guard'

import { UnenrollButton } from './unenroll-button'

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
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Hola{cuenta.nombre ? `, ${cuenta.nombre}` : ''}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {cuenta.email} · rol: {cuenta.rol}
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Mis inscripciones</h2>
          <Link
            href="/certifications"
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            Explorar certificaciones
          </Link>
        </div>

        {inscripciones.data.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700">
            Aún no tienes inscripciones. Elige una certificación para empezar.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {inscripciones.data.map((ins) => (
              <li key={ins.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{ins.tipo_objetivo}</p>
                  <p className="text-xs text-slate-500">
                    {ins.objetivo_id} · estado: {ins.estado}
                  </p>
                </div>
                <UnenrollButton id={ins.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

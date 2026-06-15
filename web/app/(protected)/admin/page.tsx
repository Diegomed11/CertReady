import { listUsers } from '@/lib/api/services'
import { requireSession } from '@/lib/auth/guard'

/**
 * Panel de administración (solo rol admin). Lista los usuarios de la plataforma.
 * Doble verificación: esta página comprueba el rol y el backend (`GET /v1/users`)
 * exige rol admin igualmente.
 */
export default async function AdminPage() {
  const session = await requireSession()

  if (!session.roles.includes('admin')) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <span className="text-5xl" role="img" aria-hidden="true">
          🔒
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold">Acceso restringido</h1>
        <p className="mt-2 text-muted">Esta sección es solo para administradores.</p>
      </div>
    )
  }

  const page = await listUsers(session.accessToken, { limit: 100 })

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-tight">Administración</h1>
      <p className="mt-1 text-muted">
        {page.count} {page.count === 1 ? 'usuario registrado' : 'usuarios registrados'}.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border-2 border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-line bg-surface text-xs uppercase tracking-wide text-faint">
              <th className="px-4 py-3 font-semibold">Usuario</th>
              <th className="px-4 py-3 font-semibold">Rol</th>
              <th className="px-4 py-3 font-semibold">Alta</th>
            </tr>
          </thead>
          <tbody>
            {page.data.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <div className="font-semibold text-ink">{u.nombre ?? '—'}</div>
                  <div className="font-mono text-[12px] text-faint">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      u.rol === 'admin' ? 'bg-brand/10 text-brand' : 'bg-surface text-muted'
                    }`}
                  >
                    {u.rol === 'admin' ? 'Admin' : 'Estudiante'}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">
                  {new Date(u.creado_en).toLocaleDateString('es', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
              </tr>
            ))}
            {page.data.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-muted">
                  Aún no hay usuarios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

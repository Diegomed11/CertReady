import Link from 'next/link'

import { getSession, isAuthenticated } from '@/lib/auth/session'

/**
 * Página de inicio pública. Muestra el acceso al panel si ya hay sesión, o el
 * enlace de inicio de sesión en caso contrario.
 */
export default async function HomePage() {
  const session = await getSession()
  const autenticado = isAuthenticated(session)

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">CertReady</h1>
      <p className="text-lg text-slate-600 dark:text-slate-400">
        Preparación de certificaciones técnicas y entrevistas de programación.
      </p>

      {autenticado ? (
        <Link
          href="/panel"
          className="inline-block w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Ir al panel
        </Link>
      ) : (
        <a
          href="/api/auth/login"
          className="inline-block w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Iniciar sesión
        </a>
      )}
    </main>
  )
}

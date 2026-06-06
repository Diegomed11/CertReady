/**
 * Página mostrada cuando el inicio de sesión no se completa (callback inválido,
 * estado/PKCE no coincide, etc.). Ofrece reintentar el flujo.
 */
export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">No se pudo iniciar sesión</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Hubo un problema al completar el inicio de sesión. Vuelve a intentarlo.
      </p>
      <a
        href="/api/auth/login"
        className="mx-auto w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Reintentar
      </a>
    </main>
  )
}

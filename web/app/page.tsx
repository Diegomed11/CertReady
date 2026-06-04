/**
 * Página raíz pública. Las vistas reales (catálogo, panel) llegan en 3b–3d.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">CertReady</h1>
      <p className="text-lg text-slate-600 dark:text-slate-400">
        Plataforma de preparación de certificaciones y entrevistas técnicas.
      </p>
      <p className="text-sm text-slate-500">
        Inc. 3a — esqueleto del BFF. Las vistas se construyen en los próximos incrementos.
      </p>
      <a
        href="/api/auth/login"
        className="inline-block w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Iniciar sesión (mock OIDC)
      </a>
    </main>
  )
}

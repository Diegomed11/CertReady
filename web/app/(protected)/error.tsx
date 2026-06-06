'use client'

/**
 * Frontera de error de las rutas autenticadas. Se muestra si falla la carga de
 * datos (por ejemplo, si un servicio backend no responde). Ofrece reintentar.
 */
export default function ProtectedError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-slate-200 p-6 dark:border-slate-800">
      <h2 className="text-lg font-semibold">No se pudieron cargar los datos</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Es posible que un servicio no esté disponible. Inténtalo de nuevo.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Reintentar
      </button>
    </div>
  )
}

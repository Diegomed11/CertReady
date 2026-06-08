'use client'

import { Button } from '@/components/ui/button'

/**
 * Frontera de error de las rutas autenticadas. Se muestra si falla la carga de
 * datos (por ejemplo, si un servicio backend no responde). Ofrece reintentar.
 */
export default function ProtectedError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-line bg-white p-10 text-center">
      <span className="text-5xl" role="img" aria-hidden="true">
        🛠️
      </span>
      <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">
        No se pudieron cargar los datos
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Es posible que un servicio no esté disponible. Inténtalo de nuevo.
      </p>
      <div className="mt-6 flex justify-center">
        <Button onClick={reset}>Reintentar</Button>
      </div>
    </div>
  )
}

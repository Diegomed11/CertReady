import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import type { Tema } from '@/lib/api/types'

export type EstadoTema = 'completado' | 'disponible' | 'bloqueado'

export interface NodoTema {
  tema: Tema
  estado: EstadoTema
}

/** Aspecto del círculo del nodo según su estado. */
function nodoClase(estado: EstadoTema): string {
  if (estado === 'completado') return 'bg-good text-white shadow-[0_4px_0_0_rgb(20,130,80)]'
  if (estado === 'disponible')
    return 'bg-gradient-brand text-white shadow-[0_4px_0_0_rgb(var(--brand-ink))]'
  return 'bg-sunken text-faint'
}

function icono(estado: EstadoTema, orden: number): string {
  if (estado === 'completado') return '✓'
  if (estado === 'bloqueado') return '🔒'
  return String(orden)
}

/** Tarjeta de etiqueta de un tema (nombre + dominio). */
function Etiqueta({ tema, estado }: NodoTema) {
  const bloqueado = estado === 'bloqueado'
  return (
    <div
      className={`rounded-2xl border-2 p-4 ${
        bloqueado ? 'border-line bg-surface' : 'border-line bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {tema.dominio ? <Badge tone={bloqueado ? 'neutral' : 'brand'}>{tema.dominio}</Badge> : null}
        {estado === 'completado' ? <Badge tone="good">Completado</Badge> : null}
      </div>
      <p className={`mt-2 font-display font-semibold ${bloqueado ? 'text-faint' : 'text-ink'}`}>
        {tema.nombre}
      </p>
    </div>
  )
}

/**
 * LearningPath dibuja la ruta de temas como un camino vertical en zig-zag (estilo
 * Duolingo): un nodo por tema, con su estado (completado / disponible / bloqueado).
 * Los nodos disponibles o completados enlazan a su tema; los bloqueados no.
 */
export function LearningPath({ certSlug, nodos }: { certSlug: string; nodos: NodoTema[] }) {
  return (
    <div className="relative mx-auto max-w-2xl">
      {/* Columna vertebral del camino. */}
      <div
        className="absolute left-1/2 top-4 bottom-4 w-1 -translate-x-1/2 rounded bg-line"
        aria-hidden
      />

      <ul className="relative space-y-6">
        {nodos.map((n) => {
          const izquierda = n.tema.orden % 2 === 1
          const enlazable = n.estado !== 'bloqueado'
          const circulo = (
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-full font-display text-xl font-bold transition-transform ${nodoClase(
                n.estado,
              )} ${enlazable ? 'hover:-translate-y-0.5' : ''}`}
            >
              {icono(n.estado, n.tema.orden)}
            </div>
          )

          return (
            <li
              key={n.tema.id}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5"
            >
              <div className={izquierda ? '' : 'invisible'}>
                <Etiqueta {...n} />
              </div>

              <div className="flex justify-center">
                {enlazable ? (
                  <Link href={`/estudiar/${certSlug}/${n.tema.slug}`} aria-label={n.tema.nombre}>
                    {circulo}
                  </Link>
                ) : (
                  circulo
                )}
              </div>

              <div className={izquierda ? 'invisible' : ''}>
                <Etiqueta {...n} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

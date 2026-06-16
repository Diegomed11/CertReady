/**
 * Tarjeta redondeada con filete de 2px; opción interactiva (hover que eleva) y
 * `beam` para el borde con glow animado del panel (clase global `.cr-beam`).
 */
export function Card({
  className = '',
  interactive = false,
  beam = false,
  children,
}: {
  className?: string
  interactive?: boolean
  beam?: boolean
  children: React.ReactNode
}) {
  const hover = interactive
    ? 'transition-transform duration-150 hover:-translate-y-1 hover:border-brand/40'
    : ''
  return (
    <div
      className={`rounded-2xl border-2 border-line bg-white ${beam ? 'cr-beam' : ''} ${hover} ${className}`}
    >
      {children}
    </div>
  )
}

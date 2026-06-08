/** Tarjeta redondeada con filete de 2px; opción interactiva (hover que eleva). */
export function Card({
  className = '',
  interactive = false,
  children,
}: {
  className?: string
  interactive?: boolean
  children: React.ReactNode
}) {
  const hover = interactive
    ? 'transition-transform duration-150 hover:-translate-y-1 hover:border-brand/40'
    : ''
  return (
    <div className={`rounded-2xl border-2 border-line bg-white ${hover} ${className}`}>
      {children}
    </div>
  )
}

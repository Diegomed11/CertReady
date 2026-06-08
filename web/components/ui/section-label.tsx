/** Rótulo de sección: texto corto en mayúsculas, color de marca. */
export function SectionLabel({
  className = '',
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <span className={`text-xs font-bold uppercase tracking-[0.14em] text-brand ${className}`}>
      {children}
    </span>
  )
}

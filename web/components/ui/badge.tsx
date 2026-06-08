export type BadgeTone = 'neutral' | 'brand' | 'good' | 'warn' | 'bad'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-sunken text-muted',
  brand: 'bg-brand/10 text-brand',
  good: 'bg-good/15 text-good',
  warn: 'bg-warn/15 text-[rgb(180,120,20)]',
  bad: 'bg-bad/12 text-bad',
}

/** Etiqueta breve tipo píldora (proveedor, nivel, estado…). */
export function Badge({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

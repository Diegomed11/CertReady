/**
 * Gauge dibuja un indicador circular (0–100) en SVG, sin dependencias. El color
 * del arco refleja el nivel: verde (≥70), ámbar (≥40) y rojo por debajo.
 */
export function Gauge({
  value,
  size = 168,
  etiqueta,
  sufijo = '%',
}: {
  value: number
  size?: number
  etiqueta?: string
  sufijo?: string
}) {
  const v = Math.max(0, Math.min(100, value))
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - v / 100)
  const color = v >= 70 ? 'text-good' : v >= 40 ? 'text-warn' : 'text-bad'

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          className="text-sunken"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={`${color} transition-[stroke-dashoffset] duration-700`}
        />
      </svg>
      <div className="absolute text-center">
        <span className="font-display text-4xl font-bold text-ink">
          {Math.round(v)}
          <span className="text-lg text-faint">{sufijo}</span>
        </span>
        {etiqueta ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{etiqueta}</p>
        ) : null}
      </div>
    </div>
  )
}

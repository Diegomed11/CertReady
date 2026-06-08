/** Estado vacío amable (tarjeta redondeada con filete punteado). */
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-line-strong bg-surface p-10 text-center">
      <p className="font-display text-xl font-semibold text-ink">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div> : null}
    </div>
  )
}

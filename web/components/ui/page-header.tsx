/** Cabecera de página: rótulo de sección, título y entradilla. */
export function PageHeader({
  label,
  title,
  lead,
}: {
  label?: React.ReactNode
  title: string
  lead?: string
}) {
  return (
    <header>
      {label ? <div className="mb-2">{label}</div> : null}
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {title}
      </h1>
      {lead ? <p className="mt-2 max-w-2xl text-muted">{lead}</p> : null}
    </header>
  )
}

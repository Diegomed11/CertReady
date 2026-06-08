/** Contenedor con el ancho y los márgenes editoriales del sitio. */
export function Container({
  className = '',
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={`mx-auto w-full max-w-5xl px-6 sm:px-8 ${className}`}>{children}</div>
}

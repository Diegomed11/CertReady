import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Markdown renderiza contenido markdown con estilos de lectura (typography).
 * Usa remark-gfm para tablas, listas de tareas, etc. El HTML embebido NO se
 * interpreta (seguro por defecto).
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-neutral max-w-none prose-headings:font-display prose-a:text-brand prose-code:text-brand-ink">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}

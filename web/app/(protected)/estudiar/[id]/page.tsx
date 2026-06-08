import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { getContent } from '@/lib/api/services'
import { requireSession } from '@/lib/auth/guard'

/** Lector de un material de estudio. */
export default async function MaterialPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession()
  const { id } = await params
  const material = await getContent(id)
  if (!material) notFound()

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link href="/estudiar" className={buttonStyles('quiet', 'sm')}>
        ← Volver a estudiar
      </Link>

      <header>
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{material.certificacion}</Badge>
          <Badge tone="neutral">{material.tema}</Badge>
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {material.titulo}
        </h1>
      </header>

      {material.formato === 'markdown' ? (
        <Markdown>{material.contenido}</Markdown>
      ) : material.formato === 'html' ? (
        <div
          className="prose prose-neutral max-w-none"
          // Contenido administrado (creado por admin); no proviene del usuario final.
          dangerouslySetInnerHTML={{ __html: material.contenido }}
        />
      ) : (
        <pre className="whitespace-pre-wrap font-body text-base leading-relaxed text-ink">
          {material.contenido}
        </pre>
      )}

      {material.recursos.length > 0 ? (
        <footer className="border-t-2 border-line pt-5">
          <h2 className="font-display text-lg font-semibold">Recursos</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {material.recursos.map((r) => (
              <li key={r} className="break-all font-mono text-muted">
                {r}
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </article>
  )
}

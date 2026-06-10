import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Markdown } from '@/components/ui/markdown'
import { SectionLabel } from '@/components/ui/section-label'
import { getCertification, getMyProgress, listContent, listTopics } from '@/lib/api/services'
import { requireSession } from '@/lib/auth/guard'

import { QuizRunner } from '@/components/quiz-runner'

import { MarkRead } from './mark-read'

/**
 * Tema de la ruta: sus lecciones (markdown, marcables como leídas) y el mini-quiz
 * que, al aprobarse, completa el tema y desbloquea el siguiente. Si el tema está
 * bloqueado (el anterior no está aprobado), se redirige a la ruta.
 */
export default async function TemaPage({
  params,
}: {
  params: Promise<{ cert: string; tema: string }>
}) {
  const { accessToken } = await requireSession()
  const { cert: slug, tema: temaSlug } = await params

  const cert = await getCertification(slug, accessToken)
  if (!cert) notFound()

  const [temas, prog] = await Promise.all([
    listTopics(cert.id, accessToken),
    getMyProgress(accessToken, cert.slug),
  ])
  const idx = temas.findIndex((t) => t.slug === temaSlug)
  if (idx === -1) notFound()
  const tema = temas[idx]!

  const aprobados = new Set(prog.temas.filter((t) => t.quiz_aprobado).map((t) => t.tema))
  const previo = temas[idx - 1]
  const desbloqueado =
    idx === 0 || aprobados.has(tema.slug) || (previo ? aprobados.has(previo.slug) : false)
  if (!desbloqueado) redirect(`/estudiar/${slug}`)

  const lecciones = await listContent({
    certificacion: cert.slug,
    tema: tema.slug,
    accessToken,
    limit: 50,
  })
  const leidas = new Set(prog.lecciones.map((l) => l.material_id))
  const yaAprobado = aprobados.has(tema.slug)
  const siguiente = temas[idx + 1]?.slug ?? null

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href={`/estudiar/${cert.slug}`} className={buttonStyles('quiet', 'sm')}>
        ← {cert.nombre}
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <SectionLabel>Tema {tema.orden}</SectionLabel>
          {tema.dominio ? <Badge tone="brand">{tema.dominio}</Badge> : null}
          {yaAprobado ? <Badge tone="good">Completado</Badge> : null}
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {tema.nombre}
        </h1>
      </header>

      {lecciones.data.length === 0 ? (
        <EmptyState title="Aún no hay lecciones">
          Pronto añadiremos material para este tema. Puedes intentar el quiz igualmente.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {lecciones.data.map((m) => (
            <Card key={m.id} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-display text-xl font-semibold">{m.titulo}</h2>
                <MarkRead
                  cert={cert.slug}
                  tema={tema.slug}
                  materialId={m.id}
                  leida={leidas.has(m.id)}
                />
              </div>
              <div className="mt-3">
                <Markdown>{m.contenido}</Markdown>
              </div>
            </Card>
          ))}
        </div>
      )}

      <QuizRunner
        cert={cert.slug}
        temas={[tema.slug]}
        progressTema={tema.slug}
        num={4}
        titulo="Pon a prueba lo aprendido"
        yaAprobado={yaAprobado}
        nextHref={siguiente ? `/estudiar/${cert.slug}/${siguiente}` : null}
        nextLabel="Siguiente tema →"
      />
    </div>
  )
}

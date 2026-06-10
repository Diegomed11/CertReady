import Link from 'next/link'
import { notFound } from 'next/navigation'

import { buttonStyles } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { LearningPath, type EstadoTema, type NodoTema } from '@/components/learning-path'
import { QuizRunner } from '@/components/quiz-runner'
import { getCertification, getMyProgress, listTopics } from '@/lib/api/services'
import { requireSession } from '@/lib/auth/guard'

/** Convierte un nombre de dominio en una clave (slug) para el progreso. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Ruta de aprendizaje de una certificación (estilo Duolingo): sus temas en orden,
 * cada uno bloqueado / disponible / completado. Un tema se completa al aprobar su
 * quiz, lo que desbloquea el siguiente. `cert` en la URL es el slug (legible).
 */
export default async function RutaCertPage({ params }: { params: Promise<{ cert: string }> }) {
  const { accessToken } = await requireSession()
  const { cert: slug } = await params
  const cert = await getCertification(slug, accessToken)
  if (!cert) notFound()

  const [temas, prog] = await Promise.all([
    listTopics(cert.id, accessToken),
    getMyProgress(accessToken, cert.slug),
  ])
  const aprobados = new Set(prog.temas.filter((t) => t.quiz_aprobado).map((t) => t.tema))

  const nodos: NodoTema[] = temas.map((tema, i) => {
    let estado: EstadoTema
    if (aprobados.has(tema.slug)) {
      estado = 'completado'
    } else {
      const previo = temas[i - 1]
      estado = i === 0 || (previo && aprobados.has(previo.slug)) ? 'disponible' : 'bloqueado'
    }
    return { tema, estado }
  })

  const completados = nodos.filter((n) => n.estado === 'completado').length
  const total = temas.length
  const pct = total > 0 ? Math.round((completados / total) * 100) : 0

  // Agrupa los temas por dominio para el repaso por sección (un quiz por dominio).
  const secciones: { nombre: string; slugs: string[] }[] = []
  for (const t of temas) {
    const dom = t.dominio ?? 'General'
    const grupo = secciones.find((g) => g.nombre === dom)
    if (grupo) grupo.slugs.push(t.slug)
    else secciones.push({ nombre: dom, slugs: [t.slug] })
  }

  return (
    <div className="space-y-8">
      <Link href="/estudiar" className={buttonStyles('quiet', 'sm')}>
        ← Mis rutas
      </Link>

      <PageHeader
        label={<SectionLabel>{cert.proveedor}</SectionLabel>}
        title={cert.nombre}
        lead="Completa cada tema y su mini-quiz para desbloquear el siguiente."
      />

      <div className="mx-auto max-w-2xl">
        <div className="mb-1.5 flex items-center justify-between text-sm font-semibold text-muted">
          <span>
            {completados} de {total} temas completados
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-sunken">
          <div
            className="bg-gradient-brand h-full rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {total === 0 ? (
        <p className="text-center text-muted">Esta certificación aún no tiene temas.</p>
      ) : (
        <LearningPath certSlug={cert.slug} nodos={nodos} />
      )}

      {secciones.length > 0 ? (
        <section className="space-y-5 border-t-2 border-line pt-8">
          <div className="text-center">
            <SectionLabel>Repaso por sección</SectionLabel>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
              Pon a prueba un dominio completo
            </h2>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
              Cada quiz reúne preguntas de todos los temas de la sección. Ideal para repasar antes
              del examen.
            </p>
          </div>
          <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
            {secciones.map((s) => {
              const key = `seccion-${slugify(s.nombre)}`
              return (
                <QuizRunner
                  key={key}
                  cert={cert.slug}
                  temas={s.slugs}
                  progressTema={key}
                  num={Math.min(10, s.slugs.length * 4)}
                  titulo={`Repaso: ${s.nombre}`}
                  yaAprobado={aprobados.has(key)}
                />
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}

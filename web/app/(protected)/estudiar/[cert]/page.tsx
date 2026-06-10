import Link from 'next/link'
import { notFound } from 'next/navigation'

import { buttonStyles } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { LearningPath, type EstadoTema, type NodoTema } from '@/components/learning-path'
import { getCertification, getMyProgress, listTopics } from '@/lib/api/services'
import { requireSession } from '@/lib/auth/guard'

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
    </div>
  )
}

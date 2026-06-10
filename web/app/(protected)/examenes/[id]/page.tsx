import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Markdown } from '@/components/ui/markdown'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { getCertification, getExamSession, listTopics } from '@/lib/api/services'
import { requireSession } from '@/lib/auth/guard'

import { ExamRunner } from './exam-runner'

/**
 * Sesión de examen: si está en curso, monta el runner cronometrado; si está
 * finalizada, muestra el repaso persistido (puntaje, tu respuesta, la correcta y
 * la explicación). El enunciado no se vuelve a servir tras finalizar (diseño
 * anti-fuga del banco), por eso el repaso histórico es más escueto que el del
 * momento de entregar.
 */
export default async function SesionExamenPage({ params }: { params: Promise<{ id: string }> }) {
  const { accessToken } = await requireSession()
  const { id } = await params
  const rev = await getExamSession(accessToken, id)
  if (!rev) notFound()

  if (rev.estado === 'en_curso' && rev.preguntas && rev.preguntas.length > 0) {
    // Mapa tema → dominio para el desglose por sección del resultado.
    const cert = await getCertification(rev.certificacion, accessToken)
    const topics = cert ? await listTopics(cert.id, accessToken) : []
    const temaDominio: Record<string, string> = {}
    for (const t of topics) if (t.dominio) temaDominio[t.slug] = t.dominio

    return (
      <div className="space-y-8">
        <PageHeader label={<SectionLabel>Examen en curso</SectionLabel>} title="Responde" />
        <ExamRunner sesionId={id} preguntas={rev.preguntas} temaDominio={temaDominio} />
      </div>
    )
  }

  const r = rev.resultado
  const puntaje = rev.puntaje ?? r?.puntaje ?? 0
  const aprobado = puntaje >= 72

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link href="/examenes" className={buttonStyles('quiet', 'sm')}>
        ← Volver a exámenes
      </Link>

      <Card className="overflow-hidden">
        <div
          className={`px-6 py-8 text-center text-white ${aprobado ? 'bg-good' : 'bg-gradient-brand'}`}
        >
          <p className="font-display text-6xl font-bold">
            {Math.round(puntaje)}
            <span className="text-2xl opacity-80">%</span>
          </p>
          <p className="mt-1 text-sm font-semibold opacity-90">
            {aprobado ? 'Aprobado' : 'Reprobado'} · se aprueba con 72%
          </p>
        </div>
        <div className="p-6 text-center">
          <p className="font-display text-xl font-bold text-ink">
            {aprobado ? '¡Aprobado! 🎉' : 'Sigue practicando 💪'}
          </p>
          {r ? (
            <p className="mt-1 text-sm text-muted">
              Acertaste {r.correctas} de {r.total} preguntas.
            </p>
          ) : null}
        </div>
      </Card>

      {r && r.resultados.length > 0 ? (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Repaso</h2>
          {r.resultados.map((rp, i) => (
            <Card key={rp.ref} className="p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm font-semibold text-faint">
                  Pregunta #{i + 1}
                </span>
                <Badge tone={rp.correcto ? 'good' : 'bad'}>
                  {rp.correcto ? 'Correcta' : 'Incorrecta'}
                </Badge>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-faint">
                    Tu respuesta
                  </dt>
                  <dd className="font-mono text-ink">
                    {rp.seleccion.length > 0 ? rp.seleccion.join(', ') : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold uppercase tracking-wide text-faint">Correcta</dt>
                  <dd className="font-mono text-good">{rp.respuesta_correcta.join(', ')}</dd>
                </div>
              </dl>
              {rp.explicacion ? (
                <div className="mt-4 rounded-xl border-2 border-line bg-surface p-4">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-brand">
                    Explicación
                  </p>
                  <Markdown>{rp.explicacion}</Markdown>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}

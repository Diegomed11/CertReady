import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import { buttonStyles } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Markdown } from '@/components/ui/markdown'
import { getProblem } from '@/lib/api/services'
import { requireSession } from '@/lib/auth/guard'

import { CodeRunner } from './code-runner'

function dificultadTone(d: string): BadgeTone {
  if (d === 'facil') return 'good'
  if (d === 'media') return 'warn'
  return 'bad'
}

/** Detalle de un problema de código: enunciado, ejemplos y editor + juez. */
export default async function ProblemaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession()
  const { id } = await params
  const problema = await getProblem(id)
  if (!problema) notFound()

  const ejemplos = problema.casos.filter((c) => !c.oculto)

  return (
    <div className="space-y-8">
      <Link href="/entrevistas/problemas" className={buttonStyles('quiet', 'sm')}>
        ← Volver a problemas
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={dificultadTone(problema.dificultad)}>{problema.dificultad}</Badge>
          <Badge tone="neutral">{problema.area}</Badge>
          {problema.etiquetas.map((e) => (
            <Badge key={e} tone="brand">
              {e}
            </Badge>
          ))}
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {problema.titulo}
        </h1>
        <p className="mt-2 font-mono text-xs text-faint">
          Límites: {problema.limite_tiempo_ms} ms · {problema.limite_memoria_mb} MB
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="p-6">
            <Markdown>{problema.enunciado}</Markdown>
          </Card>

          {ejemplos.length > 0 ? (
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold">Ejemplos</h2>
              {ejemplos.map((c, i) => (
                <Card key={i} className="p-4">
                  <p className="mb-2 font-mono text-xs font-semibold text-faint">Ejemplo {i + 1}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-faint">
                        Entrada
                      </p>
                      <pre className="overflow-x-auto rounded-lg border-2 border-line bg-surface p-2 font-mono text-xs text-ink">
                        {c.entrada || '∅'}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-faint">
                        Salida
                      </p>
                      <pre className="overflow-x-auto rounded-lg border-2 border-line bg-surface p-2 font-mono text-xs text-ink">
                        {c.salida_esperada}
                      </pre>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <CodeRunner problema={problema} />
        </div>
      </div>
    </div>
  )
}

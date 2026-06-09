'use client'

import { useState } from 'react'

import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CodeEditor } from '@/components/ui/code-editor'
import type { Problema, RespuestaCorrida, VeredictoJuez } from '@/lib/api/types'

/** Etiqueta y tono de cada veredicto global. */
const VEREDICTO: Record<VeredictoJuez, { label: string; tone: BadgeTone }> = {
  accepted: { label: 'Aceptado', tone: 'good' },
  wrong_answer: { label: 'Respuesta incorrecta', tone: 'bad' },
  time_limit_exceeded: { label: 'Tiempo excedido', tone: 'warn' },
  memory_limit_exceeded: { label: 'Memoria excedida', tone: 'warn' },
  runtime_error: { label: 'Error en ejecución', tone: 'bad' },
  compile_error: { label: 'Error de compilación', tone: 'bad' },
}

/** Símbolo por estado de un caso. */
function simboloCaso(estado: string): { icono: string; color: string } {
  if (estado === 'passed') return { icono: '✓', color: 'text-good' }
  if (estado === 'tle' || estado === 'mle') return { icono: '◷', color: 'text-warn' }
  return { icono: '✗', color: 'text-bad' }
}

/**
 * CodeRunner es el editor + ejecución contra el juez de un problema. Elige el
 * lenguaje (de los permitidos), parte de la plantilla y, al ejecutar, muestra el
 * veredicto global y el detalle por caso (los ocultos solo reportan su estado).
 */
export function CodeRunner({ problema }: { problema: Problema }) {
  const lenguajes = problema.lenguajes_permitidos
  const [lenguaje, setLenguaje] = useState(lenguajes[0] ?? 'python')
  const plantilla = (l: string) => problema.plantillas?.[l] ?? ''
  const [fuente, setFuente] = useState(plantilla(lenguajes[0] ?? 'python'))
  const [corriendo, setCorriendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [respuesta, setRespuesta] = useState<RespuestaCorrida | null>(null)

  function cambiarLenguaje(l: string) {
    setLenguaje(l)
    setFuente(plantilla(l))
  }

  async function ejecutar() {
    setCorriendo(true)
    setError(null)
    try {
      const res = await fetch('/api/judge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ problema_ref: problema.id, lenguaje, fuente }),
      })
      if (res.status === 503) {
        setError('El juez no está disponible ahora mismo (¿está encendido Docker?).')
        return
      }
      if (res.status === 422) {
        setError('Ese lenguaje no está permitido para este problema.')
        return
      }
      if (!res.ok) {
        setError('No se pudo ejecutar el código. Inténtalo de nuevo.')
        return
      }
      setRespuesta((await res.json()) as RespuestaCorrida)
    } catch {
      setError('No se pudo ejecutar el código. Inténtalo de nuevo.')
    } finally {
      setCorriendo(false)
    }
  }

  const resultado = respuesta?.resultado
  const v = resultado ? VEREDICTO[resultado.veredicto] : null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Lenguaje</span>
          {lenguajes.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => cambiarLenguaje(l)}
              className={`rounded-lg border-2 px-3 py-1 font-mono text-xs font-bold transition-colors ${
                lenguaje === l
                  ? 'border-brand bg-brand/10 text-brand'
                  : 'border-line-strong text-muted hover:border-brand'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <Button onClick={ejecutar} disabled={corriendo || fuente.trim().length === 0}>
          {corriendo ? 'Ejecutando…' : '▶ Ejecutar'}
        </Button>
      </div>

      <CodeEditor
        value={fuente}
        onChange={setFuente}
        language={lenguaje}
        onReset={() => setFuente(plantilla(lenguaje))}
        disabled={corriendo}
      />

      {error ? (
        <Card className="border-bad/40 bg-bad/5 p-4">
          <p className="text-sm font-semibold text-bad">{error}</p>
        </Card>
      ) : null}

      {corriendo ? (
        <p className="text-center font-mono text-sm text-muted">
          Ejecutando en el sandbox… esto puede tardar unos segundos.
        </p>
      ) : null}

      {resultado && v ? (
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge tone={v.tone}>{v.label}</Badge>
            <span className="font-mono text-sm text-muted">
              {resultado.casos_pasados}/{resultado.casos_total} casos · {resultado.duracion_ms} ms
            </span>
          </div>

          <ul className="mt-4 space-y-3">
            {resultado.casos.map((c) => {
              const s = simboloCaso(c.estado)
              return (
                <li key={c.indice} className="rounded-xl border-2 border-line p-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-base font-bold ${s.color}`}>{s.icono}</span>
                    <span className="font-mono text-sm font-semibold text-ink">
                      Caso {c.indice + 1}
                    </span>
                    {c.oculto ? <Badge tone="neutral">oculto</Badge> : null}
                    <span className="ml-auto font-mono text-xs uppercase text-faint">
                      {c.estado}
                    </span>
                  </div>
                  {!c.oculto && (c.entrada || c.salida_esperada || c.salida_obtenida) ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <CampoCaso titulo="Entrada" valor={c.entrada} />
                      <CampoCaso titulo="Esperada" valor={c.salida_esperada} />
                      <CampoCaso
                        titulo="Obtenida"
                        valor={c.salida_obtenida}
                        resaltado={c.estado === 'wrong'}
                      />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}

/** Campo monoespaciado de un caso (entrada/salida). */
function CampoCaso({
  titulo,
  valor,
  resaltado = false,
}: {
  titulo: string
  valor?: string
  resaltado?: boolean
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-faint">{titulo}</p>
      <pre
        className={`overflow-x-auto rounded-lg border-2 p-2 font-mono text-xs ${
          resaltado ? 'border-bad/40 bg-bad/5 text-bad' : 'border-line bg-surface text-ink'
        }`}
      >
        {valor && valor.length > 0 ? valor : '∅'}
      </pre>
    </div>
  )
}

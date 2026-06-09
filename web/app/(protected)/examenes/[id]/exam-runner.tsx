'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonStyles } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Markdown } from '@/components/ui/markdown'
import type { PreguntaPublica, ResultadoExamen } from '@/lib/api/types'

/** Presupuesto de tiempo por pregunta (segundos) para el cronómetro del simulacro. */
const SEG_POR_PREGUNTA = 90

function mmss(total: number): string {
  const s = Math.max(0, total)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

/**
 * ExamRunner presenta un simulacro cronometrado pregunta a pregunta y, al
 * entregar, muestra el repaso con la respuesta correcta y la explicación de cada
 * una. Mantiene en memoria las preguntas para que el repaso sea rico (enunciado y
 * opciones), algo que la consulta de una sesión ya finalizada no vuelve a servir.
 */
export function ExamRunner({
  sesionId,
  preguntas,
}: {
  sesionId: string
  preguntas: PreguntaPublica[]
}) {
  const [idx, setIdx] = useState(0)
  const [sel, setSel] = useState<Record<string, string[]>>({})
  const [restante, setRestante] = useState(preguntas.length * SEG_POR_PREGUNTA)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoExamen | null>(null)
  const enviadoRef = useRef(false)
  const entregarRef = useRef<() => void>(() => {})

  async function entregar() {
    if (enviadoRef.current) return
    enviadoRef.current = true
    setEnviando(true)
    setError(null)
    try {
      const body = {
        respuestas: preguntas.map((p) => ({ ref: p.ref, seleccion: sel[p.ref] ?? [] })),
      }
      const res = await fetch(`/api/examenes/${sesionId}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        enviadoRef.current = false
        setError('No se pudo entregar el examen. Inténtalo de nuevo.')
        return
      }
      setResultado((await res.json()) as ResultadoExamen)
    } catch {
      enviadoRef.current = false
      setError('No se pudo entregar el examen. Inténtalo de nuevo.')
    } finally {
      setEnviando(false)
    }
  }
  entregarRef.current = entregar

  // Cronómetro: descuenta cada segundo hasta 0 y se detiene (también al entregar).
  useEffect(() => {
    if (resultado || restante <= 0) return
    const t = setTimeout(() => setRestante(restante - 1), 1000)
    return () => clearTimeout(t)
  }, [restante, resultado])

  // Entrega automática cuando se acaba el tiempo.
  useEffect(() => {
    if (restante <= 0) entregarRef.current()
  }, [restante])

  if (resultado) {
    return <Repaso preguntas={preguntas} resultado={resultado} />
  }

  const p = preguntas[idx]
  if (!p) return null
  const refActual = p.ref
  const seleccion = sel[refActual] ?? []
  const respondidas = preguntas.filter((q) => (sel[q.ref] ?? []).length > 0).length
  const ultima = idx === preguntas.length - 1
  const tiempoColor = restante <= 30 ? 'text-bad' : restante <= 60 ? 'text-warn' : 'text-ink'

  function toggle(opcionId: string) {
    setSel((prev) => {
      const actual = prev[refActual] ?? []
      const next = actual.includes(opcionId)
        ? actual.filter((x) => x !== opcionId)
        : [...actual, opcionId]
      return { ...prev, [refActual]: next }
    })
  }

  function confirmarEntrega() {
    if (respondidas < preguntas.length) {
      const faltan = preguntas.length - respondidas
      if (!window.confirm(`Te faltan ${faltan} pregunta(s) por responder. ¿Entregar igualmente?`)) {
        return
      }
    }
    entregar()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-sm font-semibold text-muted">
          Pregunta {idx + 1} de {preguntas.length}
        </span>
        <span className={`font-mono text-lg font-bold tabular-nums ${tiempoColor}`}>
          ⏱ {mmss(restante)}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-sunken">
        <div
          className="bg-gradient-brand h-full rounded-full transition-all duration-300"
          style={{ width: `${((idx + 1) / preguntas.length) * 100}%` }}
        />
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">{p.tema}</Badge>
          <Badge tone="neutral">{p.dificultad}</Badge>
        </div>
        <div className="mt-4">
          <Markdown>{p.enunciado}</Markdown>
        </div>

        <ul className="mt-5 space-y-3">
          {p.opciones.map((o) => {
            const activa = seleccion.includes(o.id)
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => toggle(o.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                    activa
                      ? 'border-brand bg-brand/10 text-ink'
                      : 'border-line-strong bg-white text-ink hover:border-brand/50'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold ${
                      activa ? 'border-brand bg-brand text-white' : 'border-line-strong text-faint'
                    }`}
                  >
                    {activa ? '✓' : ''}
                  </span>
                  <span className="font-medium">{o.texto}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-xs text-faint">Puedes seleccionar una o varias opciones.</p>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
        >
          ← Anterior
        </Button>

        <span className="font-mono text-xs text-faint">
          {respondidas}/{preguntas.length} respondidas
        </span>

        {ultima ? (
          <Button onClick={confirmarEntrega} disabled={enviando}>
            {enviando ? 'Entregando…' : 'Entregar'}
          </Button>
        ) : (
          <Button onClick={() => setIdx((i) => Math.min(preguntas.length - 1, i + 1))}>
            Siguiente →
          </Button>
        )}
      </div>

      {!ultima ? (
        <div className="text-center">
          <button
            type="button"
            onClick={confirmarEntrega}
            disabled={enviando}
            className={buttonStyles('quiet', 'sm')}
          >
            Entregar ahora
          </button>
        </div>
      ) : null}

      {error ? <p className="text-center text-sm font-semibold text-bad">{error}</p> : null}
    </div>
  )
}

/** Repaso enriquecido tras entregar: une preguntas (memoria) con el resultado. */
function Repaso({
  preguntas,
  resultado,
}: {
  preguntas: PreguntaPublica[]
  resultado: ResultadoExamen
}) {
  const porRef = new Map(resultado.resultados.map((r) => [r.ref, r]))
  const aprobado = resultado.puntaje >= 70

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Card className="overflow-hidden">
        <div className="bg-gradient-brand px-6 py-8 text-center text-white">
          <p className="font-display text-6xl font-bold">{Math.round(resultado.puntaje)}</p>
          <p className="mt-1 text-sm font-semibold opacity-90">de 100 puntos</p>
        </div>
        <div className="p-6 text-center">
          <p className="font-display text-xl font-bold text-ink">
            {aprobado ? '¡Bien hecho! 🎉' : 'Sigue practicando 💪'}
          </p>
          <p className="mt-1 text-sm text-muted">
            Acertaste {resultado.correctas} de {resultado.total} preguntas.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/examenes" className={buttonStyles('primary', 'md')}>
              Ver mi historial
            </Link>
            <Link href="/progreso" className={buttonStyles('ghost', 'md')}>
              Ver mi progreso
            </Link>
          </div>
        </div>
      </Card>

      <div className="space-y-5">
        <h2 className="font-display text-xl font-semibold">Repaso</h2>
        {preguntas.map((p, i) => {
          const rp = porRef.get(p.ref)
          const correctas = new Set(rp?.respuesta_correcta ?? [])
          const elegidas = new Set(rp?.seleccion ?? [])
          return (
            <Card key={p.ref} className="p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-sm font-semibold text-faint">#{i + 1}</span>
                <Badge tone={rp?.correcto ? 'good' : 'bad'}>
                  {rp?.correcto ? 'Correcta' : 'Incorrecta'}
                </Badge>
              </div>
              <div className="mt-2">
                <Markdown>{p.enunciado}</Markdown>
              </div>

              <ul className="mt-4 space-y-2">
                {p.opciones.map((o) => {
                  const esCorrecta = correctas.has(o.id)
                  const elegida = elegidas.has(o.id)
                  const tono = esCorrecta
                    ? 'border-good bg-good/10 text-ink'
                    : elegida
                      ? 'border-bad bg-bad/10 text-ink'
                      : 'border-line text-muted'
                  return (
                    <li
                      key={o.id}
                      className={`flex items-center gap-3 rounded-xl border-2 px-4 py-2.5 ${tono}`}
                    >
                      <span className="w-5 shrink-0 text-center text-sm font-bold">
                        {esCorrecta ? '✓' : elegida ? '✗' : ''}
                      </span>
                      <span className="font-medium">{o.texto}</span>
                      {elegida ? (
                        <span className="ml-auto text-xs font-bold uppercase tracking-wide text-faint">
                          Tu respuesta
                        </span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>

              {rp?.explicacion ? (
                <div className="mt-4 rounded-xl border-2 border-line bg-surface p-4">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-brand">
                    Explicación
                  </p>
                  <Markdown>{rp.explicacion}</Markdown>
                </div>
              ) : null}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

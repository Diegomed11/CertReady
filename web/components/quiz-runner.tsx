'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Button, buttonStyles } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Markdown } from '@/components/ui/markdown'
import type { ResultadoExamen, SesionConPreguntas } from '@/lib/api/types'

type Fase = 'inicio' | 'curso' | 'resultado'

/** Capa a pantalla completa que aísla el quiz: el material de estudio queda oculto. */
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg fixed inset-0 z-50 overflow-y-auto">
      <div className="mx-auto min-h-full w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </div>
    </div>
  )
}

/**
 * QuizRunner ejecuta un quiz a pantalla completa reutilizable: sirve para el
 * mini-quiz de un tema (`temas` con un elemento) o para el repaso de una sección
 * completa (`temas` con varios). Inicia una sesión de práctica acotada a esos temas
 * (servicio de exámenes), califica, reporta el resultado al servicio de progreso
 * bajo `progressTema` y, si se aprueba, ofrece continuar.
 */
export function QuizRunner({
  cert,
  temas,
  progressTema,
  num,
  titulo,
  yaAprobado,
  nextHref = null,
  nextLabel = 'Siguiente tema →',
}: {
  cert: string
  temas: string[]
  progressTema: string
  num: number
  titulo: string
  yaAprobado: boolean
  nextHref?: string | null
  nextLabel?: string
}) {
  const [fase, setFase] = useState<Fase>('inicio')
  const [sesion, setSesion] = useState<SesionConPreguntas | null>(null)
  const [idx, setIdx] = useState(0)
  const [sel, setSel] = useState<Record<string, string[]>>({})
  const [resultado, setResultado] = useState<ResultadoExamen | null>(null)
  const [aprobado, setAprobado] = useState(yaAprobado)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function empezar() {
    setLoading(true)
    setError(null)
    setSel({})
    setIdx(0)
    setResultado(null)
    try {
      const res = await fetch('/api/examenes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ certificacion: cert, temas, num_preguntas: num, modo: 'practica' }),
      })
      if (res.status === 422) {
        setError('Aún no hay preguntas para este quiz.')
        return
      }
      if (!res.ok) {
        setError('No se pudo iniciar el quiz. Inténtalo de nuevo.')
        return
      }
      setSesion((await res.json()) as SesionConPreguntas)
      setFase('curso')
    } catch {
      setError('No se pudo iniciar el quiz. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function entregar() {
    if (!sesion) return
    setLoading(true)
    setError(null)
    try {
      const body = {
        respuestas: sesion.preguntas.map((p) => ({ ref: p.ref, seleccion: sel[p.ref] ?? [] })),
      }
      const res = await fetch(`/api/examenes/${sesion.id}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        setError('No se pudo entregar el quiz. Inténtalo de nuevo.')
        return
      }
      const r = (await res.json()) as ResultadoExamen
      setResultado(r)
      const pr = await fetch('/api/progress/quizzes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ certificacion: cert, tema: progressTema, puntaje: r.puntaje }),
      })
      if (pr.ok) {
        const tp = (await pr.json()) as { quiz_aprobado: boolean }
        setAprobado(tp.quiz_aprobado)
      }
      setFase('resultado')
    } catch {
      setError('No se pudo entregar el quiz. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  // --- inicio (en línea) ---------------------------------------------------
  if (fase === 'inicio') {
    return (
      <Card className="flex h-full flex-col p-6 text-center">
        <p className="text-3xl">{aprobado ? '🏆' : '🧠'}</p>
        <h2 className="mt-2 font-display text-lg font-bold">
          {aprobado ? `${titulo} · superado` : titulo}
        </h2>
        <div className="mt-auto pt-5">
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={empezar} disabled={loading}>
              {loading ? 'Preparando…' : aprobado ? 'Repetir' : 'Empezar'}
            </Button>
            {aprobado && nextHref ? (
              <Link href={nextHref} className={buttonStyles('ghost', 'md')}>
                {nextLabel}
              </Link>
            ) : null}
          </div>
          {error ? <p className="mt-3 text-sm font-semibold text-bad">{error}</p> : null}
        </div>
      </Card>
    )
  }

  // --- resultado (overlay) -------------------------------------------------
  if (fase === 'resultado' && resultado) {
    return (
      <Overlay>
        <Card className="overflow-hidden">
          <div
            className={`px-6 py-8 text-center text-white ${aprobado ? 'bg-good' : 'bg-gradient-brand'}`}
          >
            <p className="font-display text-5xl font-bold">{Math.round(resultado.puntaje)}%</p>
            <p className="mt-1 text-sm font-semibold opacity-90">
              {resultado.correctas} de {resultado.total} correctas
            </p>
          </div>
          <div className="p-6 text-center">
            <p className="font-display text-xl font-bold">
              {aprobado ? '¡Aprobado! 🎉' : 'Te faltó poco 💪'}
            </p>
            <p className="mt-1 text-sm text-muted">
              {aprobado
                ? nextHref
                  ? 'Desbloqueaste lo siguiente.'
                  : '¡Bien hecho!'
                : 'Necesitas un 70%. Repasa y vuelve a intentarlo.'}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {aprobado && nextHref ? (
                <Link href={nextHref} className={buttonStyles('primary', 'md')}>
                  {nextLabel}
                </Link>
              ) : null}
              {!aprobado ? (
                <Button onClick={() => setFase('inicio')}>Repasar el material</Button>
              ) : null}
              <Link href={`/estudiar/${cert}`} className={buttonStyles('ghost', 'md')}>
                Volver a la ruta
              </Link>
            </div>
          </div>
        </Card>
      </Overlay>
    )
  }

  // --- curso (overlay, respondiendo) ---------------------------------------
  if (!sesion) return null
  const p = sesion.preguntas[idx]
  if (!p) return null
  const ref = p.ref
  const seleccion = sel[ref] ?? []
  const ultima = idx === sesion.preguntas.length - 1

  function toggle(opcionId: string) {
    setSel((prev) => {
      const actual = prev[ref] ?? []
      const next = actual.includes(opcionId)
        ? actual.filter((x) => x !== opcionId)
        : [...actual, opcionId]
      return { ...prev, [ref]: next }
    })
  }

  return (
    <Overlay>
      <div className="mb-4 flex items-center justify-between gap-4">
        <span className="font-mono text-sm font-semibold text-muted">
          Pregunta {idx + 1} de {sesion.preguntas.length}
        </span>
        <button
          type="button"
          onClick={() => setFase('inicio')}
          className="text-sm font-semibold text-faint transition-colors hover:text-bad"
        >
          ✕ Salir
        </button>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-sunken">
        <div
          className="bg-gradient-brand h-full rounded-full transition-all"
          style={{ width: `${((idx + 1) / sesion.preguntas.length) * 100}%` }}
        />
      </div>

      <Card className="mt-6 p-6">
        <Markdown>{p.enunciado}</Markdown>

        <ul className="mt-4 space-y-3">
          {p.opciones.map((o) => {
            const activa = seleccion.includes(o.id)
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => toggle(o.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                    activa
                      ? 'border-brand bg-brand/10'
                      : 'border-line-strong bg-white hover:border-brand/50'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold ${
                      activa ? 'border-brand bg-brand text-white' : 'border-line-strong text-faint'
                    }`}
                  >
                    {activa ? '✓' : ''}
                  </span>
                  <span className="font-medium text-ink">{o.texto}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Card>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0}
        >
          ← Anterior
        </Button>
        {ultima ? (
          <Button onClick={entregar} disabled={loading}>
            {loading ? 'Calificando…' : 'Entregar'}
          </Button>
        ) : (
          <Button onClick={() => setIdx((i) => Math.min(sesion.preguntas.length - 1, i + 1))}>
            Siguiente →
          </Button>
        )}
      </div>
      {error ? <p className="mt-3 text-center text-sm font-semibold text-bad">{error}</p> : null}
    </Overlay>
  )
}

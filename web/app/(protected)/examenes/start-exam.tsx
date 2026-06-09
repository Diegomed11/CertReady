'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

/** Opciones de número de preguntas del simulacro. */
const TAMANOS = [5, 10, 20]

/**
 * StartExam es el formulario para iniciar un simulacro: elige certificación y
 * número de preguntas, llama al BFF y navega a la sesión creada. Si no hay
 * preguntas para la certificación, muestra un mensaje claro (no un error crudo).
 */
export function StartExam({
  certificaciones,
}: {
  certificaciones: { id: string; nombre: string }[]
}) {
  const router = useRouter()
  const [cert, setCert] = useState(certificaciones[0]?.id ?? '')
  const [num, setNum] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function iniciar() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/examenes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ certificacion: cert, num_preguntas: num, modo: 'simulacro' }),
      })
      if (res.status === 422) {
        setError('No hay preguntas disponibles para esa certificación todavía.')
        return
      }
      if (!res.ok) {
        setError('No se pudo iniciar el simulacro. Inténtalo de nuevo.')
        return
      }
      const sesion = (await res.json()) as { id: string }
      router.push(`/examenes/${sesion.id}`)
    } catch {
      setError('No se pudo iniciar el simulacro. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
            Certificación
          </span>
          <select
            value={cert}
            onChange={(e) => setCert(e.target.value)}
            className="w-full rounded-xl border-2 border-line-strong bg-white px-3 py-2.5 text-sm font-semibold text-ink outline-none transition-colors focus:border-brand"
          >
            {certificaciones.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <div className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
            Preguntas
          </span>
          <div className="flex gap-2">
            {TAMANOS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setNum(t)}
                className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-colors ${
                  num === t
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-line-strong text-muted hover:border-brand'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={iniciar} disabled={loading || !cert}>
          {loading ? 'Preparando…' : 'Empezar simulacro'}
        </Button>
        {error ? <span className="text-sm font-semibold text-bad">{error}</span> : null}
      </div>
    </div>
  )
}

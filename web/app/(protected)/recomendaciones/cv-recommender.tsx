'use client'

import Link from 'next/link'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonStyles } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Camino, PasoCamino, Recomendaciones } from '@/lib/api/types'

const NIVEL: Record<string, string> = {
  foundational: 'Fundamentos',
  associate: 'Asociado',
  professional: 'Profesional',
  specialty: 'Especialidad',
}

function nivelLabel(n: string): string {
  return NIVEL[n] ?? n
}

/** Tarjeta de un paso (certificación recomendada). */
function Paso({ paso }: { paso: PasoCamino }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border-2 border-line bg-bg px-4 py-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand/10 font-display text-sm font-bold text-brand">
        {paso.match_pct}%
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{paso.proveedor}</Badge>
          <span className="font-display text-sm font-semibold text-ink">{paso.nombre}</span>
          <Badge tone="brand">{nivelLabel(paso.nivel)}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted">{paso.por_que}</p>
      </div>
      {paso.tiene_contenido && paso.slug_estudio ? (
        <Link
          href={`/estudiar/${paso.slug_estudio}`}
          className={`${buttonStyles('ghost', 'sm')} shrink-0`}
        >
          Estudiar →
        </Link>
      ) : null}
    </div>
  )
}

/** Tarjeta de un camino (secuencia de pasos). */
function CaminoCard({ camino }: { camino: Camino }) {
  return (
    <Card className="p-5 sm:p-6">
      <h3 className="font-display text-lg font-bold">{camino.nombre}</h3>
      <p className="mt-0.5 text-sm text-muted">{camino.motivo}</p>
      <div className="mt-4 space-y-2.5">
        {camino.pasos.map((p) => (
          <Paso key={p.slug} paso={p} />
        ))}
      </div>
    </Card>
  )
}

/**
 * CvRecommender sube el CV del usuario (PDF/DOCX), lo manda al BFF y muestra el
 * perfil detectado y los caminos de certificación recomendados. El archivo se
 * procesa en el servidor (capa de datos) y no se guarda.
 */
export function CvRecommender() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Recomendaciones | null>(null)

  async function analizar() {
    if (!file) return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const fd = new FormData()
      fd.append('file', file, file.name)
      const res = await fetch('/api/recommendations', { method: 'POST', body: fd })
      if (res.status === 422) {
        setError('No pudimos leer texto del archivo. Sube un PDF o DOCX con texto (no una imagen).')
        return
      }
      if (!res.ok) {
        setError('No se pudo analizar el CV. Inténtalo de nuevo.')
        return
      }
      setData((await res.json()) as Recomendaciones)
    } catch {
      setError('No se pudo analizar el CV. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <Card className="p-6">
        <label className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setError(null)
            }}
            className="block w-full text-sm text-muted file:mr-4 file:rounded-lg file:border-2 file:border-line-strong file:bg-white file:px-4 file:py-2 file:font-display file:text-sm file:font-semibold file:text-brand hover:file:border-brand"
          />
          <Button onClick={analizar} disabled={!file || loading} className="shrink-0">
            {loading ? 'Analizando…' : 'Analizar mi CV'}
          </Button>
        </label>
        <p className="mt-3 text-xs text-faint">
          Aceptamos PDF o DOCX (máx 5 MB). Tu CV se procesa en el momento para detectar tu perfil y{' '}
          <span className="font-semibold">no se guarda</span>.
        </p>
        {error ? <p className="mt-3 text-sm font-semibold text-bad">{error}</p> : null}
      </Card>

      {data ? (
        <div className="space-y-8">
          {/* Perfil detectado */}
          <Card className="p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-brand">Tu perfil</p>
            <p className="mt-1 text-muted">{data.perfil.resumen}</p>
            {data.perfil.skills.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.perfil.skills.slice(0, 18).map((s) => (
                  <Badge key={s} tone="neutral">
                    {s}
                  </Badge>
                ))}
              </div>
            ) : null}
          </Card>

          {/* Caminos */}
          {data.caminos.length > 0 ? (
            <section className="space-y-4">
              <h2 className="font-display text-xl font-bold">Tus mejores caminos</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {data.caminos.map((c) => (
                  <CaminoCard key={c.nombre} camino={c} />
                ))}
              </div>
            </section>
          ) : null}

          {/* Recomendaciones top */}
          {data.recomendaciones.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold">Recomendadas para ti</h2>
              <div className="space-y-2.5">
                {data.recomendaciones.map((p) => (
                  <Paso key={p.slug} paso={p} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'

import { Illustration } from './illustrations'

/** Instancia mínima de Scene3D que usamos (montaje/limpieza). */
type SceneInstance = { destroy: () => void }
type SceneCtor = new (
  el: HTMLElement,
  builder: unknown,
  opts: Record<string, unknown>,
) => SceneInstance

/** webglAvailable indica si el navegador puede crear un contexto WebGL. */
function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl') || c.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

/**
 * LandingScene monta una escena 3D (Three.js) de la sección indicada dentro de un
 * contenedor con relación de aspecto. El código de las escenas vive en
 * `components/landing3d/` y se carga de forma diferida (solo en el cliente), así
 * que `three` no entra al render del servidor ni a otras páginas.
 *
 * Si no hay WebGL (o falla el montaje) cae a la ilustración SVG equivalente
 * (`components/illustrations`). La animación respeta `prefers-reduced-motion`
 * (lo gestiona `Scene3D`, que en ese caso deja un fotograma estático).
 */
export function LandingScene({
  name,
  hero = false,
  className,
}: {
  name: string
  hero?: boolean
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [fallback, setFallback] = useState(false)

  useEffect(() => {
    if (!webglAvailable()) {
      setFallback(true)
      return
    }
    let inst: SceneInstance | null = null
    let cancelled = false
    void (async () => {
      try {
        const [{ Scene3D }, { SCENES }] = await Promise.all([
          import('./landing3d/three-helpers'),
          import('./landing3d/scenes'),
        ])
        if (cancelled || !ref.current) return
        const builder = (SCENES as Record<string, unknown>)[hero ? 'heroMedallion' : name]
        if (!builder) {
          setFallback(true)
          return
        }
        const Ctor = Scene3D as unknown as SceneCtor
        inst = new Ctor(ref.current, builder, hero ? { dist: 9.5, noEntrance: true } : { dist: 9 })
      } catch {
        if (!cancelled) setFallback(true)
      }
    })()
    return () => {
      cancelled = true
      if (inst) inst.destroy()
    }
  }, [name, hero])

  return (
    <div className={`relative ${className ?? ''}`}>
      {/* halo de marca detrás de la escena */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[6%_4%] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(156,140,250,0.28), rgba(156,140,250,0))',
        }}
      />
      {fallback ? (
        <Illustration name={name} className="relative h-full w-full" />
      ) : (
        <div ref={ref} className="relative h-full w-full" />
      )}
    </div>
  )
}

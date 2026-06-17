'use client'

import { useEffect, useState } from 'react'
import { MeshGradient } from '@paper-design/shaders-react'

/**
 * ShaderField — fondo animado WebGL (mesh-gradient) adaptado de
 * @paper-design/shaders-react, con la paleta de marca de CertReady
 * (azul→morado sobre casi-negro). Llena su contenedor posicionado (se usa dentro
 * de `.bg`, que es fixed e inset:0 en la portada).
 *
 * Respaldo: en SSR y cuando el usuario prefiere menos movimiento, renderiza el
 * degradado CSS estático (`.mesh`, definido en `app/landing.css`) en vez del
 * shader que anima en bucle.
 */
export function ShaderField() {
  // Arranca en "reduced" para que SSR y la primera pintura usen el respaldo CSS
  // (evita parpadeos de hidratación); tras montar se decide según la preferencia.
  const [reduced, setReduced] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduced(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  if (reduced) {
    return <div className="mesh" />
  }

  // El color base oscuro lo aporta `.bg` (background:#070612); esta versión de
  // MeshGradient no acepta `backgroundColor` ni `wireframe`, así que el degradado
  // se compone solo con `colors` + `speed` (props válidos de MeshGradientParams).
  //
  // `maxPixelCount` acota el lienzo: en móviles con DPR alto (×2–×3) un shader a
  // pantalla completa renderiza varios millones de píxeles por capa y se traba. Al
  // limitar el total, va fluido en celular SIN cambiar el aspecto (es un degradado
  // suave, el reescalado no se nota). Sin antialias (invisible en un gradiente) y en
  // modo bajo consumo para no recalentar/relentizar el teléfono.
  const perf = {
    maxPixelCount: 1_300_000,
    webGlContextAttributes: {
      antialias: false,
      powerPreference: 'low-power' as const,
    },
  }
  return (
    <>
      <MeshGradient
        className="absolute inset-0 h-full w-full"
        colors={['#050410', '#241d52', '#2c3585', '#7d72e0', '#e9ecff']}
        speed={0.3}
        distortion={0.8}
        swirl={0.6}
        {...perf}
      />
      <MeshGradient
        className="absolute inset-0 h-full w-full opacity-45"
        colors={['#050410', '#eef0ff', '#564bb0', '#0b0920']}
        speed={0.2}
        distortion={1}
        swirl={0.2}
        {...perf}
      />
    </>
  )
}

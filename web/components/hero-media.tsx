'use client'

import { useEffect, useState } from 'react'

/**
 * HeroMedia muestra la animación del hero a sangre (sin marco). El vídeo trae el
 * fondo en blanco, así que se funde con la página sin bordes ni máscaras. Intenta
 * reproducir `/hero.webm` o `/hero.mp4`; si el archivo no existe o el navegador no
 * puede reproducirlo, cae a un emoji animado. Bajo `prefers-reduced-motion` evita
 * el vídeo y muestra el emoji estático.
 */
export function HeroMedia() {
  const [failed, setFailed] = useState(false)
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduce(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  if (failed || reduce) {
    return (
      <div className="flex aspect-video w-full items-center justify-center">
        <span className="animate-bob text-7xl" role="img" aria-label="Graduación">
          🎓
        </span>
      </div>
    )
  }

  return (
    <video
      className="aspect-video w-full object-contain"
      autoPlay
      loop
      muted
      playsInline
      poster="/hero.jpg"
      aria-label="Animación de la app de CertReady"
      onError={() => setFailed(true)}
    >
      <source src="/hero.webm" type="video/webm" />
      <source src="/hero.mp4" type="video/mp4" />
    </video>
  )
}

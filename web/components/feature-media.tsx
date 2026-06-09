'use client'

import { useState } from 'react'

/**
 * FeatureMedia es la animación de cada sección del landing. Reproduce
 * `/features/<name>.webm`/`.mp4` (fondo en blanco, sin marco, para que se funda con
 * la página); con `object-contain` se ve completa y proporcional, sin recortes. Si
 * el archivo falta o no se puede reproducir, cae a un emoji animado.
 */
export function FeatureMedia({ name, emoji, alt }: { name: string; emoji: string; alt: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="mx-auto flex aspect-[4/3] w-full max-w-md items-center justify-center">
        <span className="animate-bob text-8xl" role="img" aria-label={alt}>
          {emoji}
        </span>
      </div>
    )
  }

  return (
    <video
      className="mx-auto aspect-[4/3] w-full max-w-md object-contain"
      autoPlay
      loop
      muted
      playsInline
      poster={`/features/${name}.jpg`}
      aria-label={alt}
      onError={() => setFailed(true)}
    >
      <source src={`/features/${name}.webm`} type="video/webm" />
      <source src={`/features/${name}.mp4`} type="video/mp4" />
    </video>
  )
}

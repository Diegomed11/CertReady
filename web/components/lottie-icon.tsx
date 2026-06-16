'use client'

import Lottie, { type LottieRefCurrentProps } from 'lottie-react'
import { useEffect, useRef, useState } from 'react'

/**
 * LottieIcon — icono animado (Lottie/lordicon) cargado desde `public/`. Reproduce
 * una "entrada" al montar y vuelve a animarse cuando `playing` pasa a true (hover
 * del ítem del menú). El JSON se trae como asset estático (no se bundlea); en SSR
 * solo se pinta el placeholder, así que el player nunca corre en el servidor.
 */
export function LottieIcon({
  src,
  size = 33,
  playing = false,
}: {
  src: string
  size?: number
  playing?: boolean
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const ref = useRef<LottieRefCurrentProps>(null)

  useEffect(() => {
    let alive = true
    fetch(src)
      .then((r) => r.json())
      .then((j) => {
        if (alive) setData(j as Record<string, unknown>)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [src])

  // Re-anima al pasar el cursor por el ítem del menú.
  useEffect(() => {
    if (playing) ref.current?.goToAndPlay(0)
  }, [playing])

  const box = {
    width: size,
    height: size,
    flex: 'none' as const,
    position: 'relative' as const,
    zIndex: 1,
  }

  if (!data) return <span aria-hidden style={{ display: 'inline-block', ...box }} />

  return (
    <Lottie
      lottieRef={ref}
      animationData={data}
      loop={false}
      autoplay
      style={box}
      aria-hidden
    />
  )
}

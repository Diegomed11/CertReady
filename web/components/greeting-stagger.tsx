'use client'

import { useEffect, useRef } from 'react'

/** Saludo letra-por-letra que entra desde desenfoque (WAAPI). */
export function GreetingStagger({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const spans = el.querySelectorAll('span')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      spans.forEach((s) => {
        s.style.opacity = '1'
      })
      return
    }
    spans.forEach((s, i) => {
      s.animate(
        [
          { opacity: 0, filter: 'blur(10px)' },
          { opacity: 1, filter: 'blur(0px)' },
        ],
        { duration: 420, delay: i * 42, easing: 'ease', fill: 'both' },
      )
    })
  }, [text])

  return (
    <span className="blur-stagger" ref={ref}>
      {[...text].map((ch, i) => (
        <span key={i}>{ch === ' ' ? ' ' : ch}</span>
      ))}
    </span>
  )
}

'use client'

import { useRef } from 'react'

/**
 * CodeEditor es un editor de código ligero (sin dependencias): un `textarea`
 * monoespaciado con tabulación a 2 espacios y un canalón de números de línea
 * sincronizado por scroll. Suficiente para enviar soluciones al juez; el
 * resaltado de sintaxis queda como mejora futura.
 */
export function CodeEditor({
  value,
  onChange,
  language,
  onReset,
  disabled = false,
}: {
  value: string
  onChange: (next: string) => void
  language: string
  onReset?: () => void
  disabled?: boolean
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const lineas = value.length === 0 ? 1 : value.split('\n').length

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const next = `${value.slice(0, start)}  ${value.slice(end)}`
      onChange(next)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      })
    }
  }

  function onScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop
  }

  return (
    <div className="overflow-hidden rounded-xl border-2 border-line-strong bg-white">
      <div className="flex items-center justify-between border-b-2 border-line bg-surface px-3 py-1.5">
        <span className="font-mono text-xs font-semibold text-muted">{language}</span>
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className="font-mono text-xs font-semibold text-faint transition-colors hover:text-brand"
          >
            Restablecer plantilla
          </button>
        ) : null}
      </div>
      <div className="flex h-80">
        <div
          ref={gutterRef}
          aria-hidden
          className="select-none overflow-hidden bg-surface py-3 pl-3 pr-2 text-right font-mono text-sm leading-6 text-faint"
        >
          {Array.from({ length: lineas }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={onScroll}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="h-full flex-1 resize-none bg-white px-3 py-3 font-mono text-sm leading-6 text-ink outline-none disabled:opacity-60"
        />
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/** Menú de una inscripción: por ahora, dar de baja el curso (con confirmación).
 * El progreso del usuario se conserva; solo se elimina la inscripción. */
export function EnrollMenu({ id, nombre }: { id: string; nombre: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  async function darDeBaja() {
    if (!window.confirm(`¿Dar de baja “${nombre}”? Tu progreso se conserva.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/enrollments/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setOpen(false)
        router.refresh()
      } else {
        window.alert('No se pudo dar de baja. Intenta de nuevo.')
      }
    } catch {
      window.alert('Error de red. Intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="enroll-menu" ref={ref}>
      <button
        className="kebab"
        onClick={() => setOpen((o) => !o)}
        aria-label="Más opciones"
        aria-expanded={open}
      >
        ⋮
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          <button onClick={darDeBaja} disabled={busy} role="menuitem">
            {busy ? 'Dando de baja…' : 'Dar de baja'}
          </button>
        </div>
      )}
    </div>
  )
}

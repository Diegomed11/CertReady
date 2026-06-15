'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { buttonStyles } from '@/components/ui/button'

/** Datos iniciales del perfil (del servidor). */
export interface ProfileInit {
  email: string
  nombre: string
  rol: 'estudiante' | 'admin'
  creadoEn: string
}

/** Formulario de perfil: por ahora solo edita el nombre; email es solo lectura. */
export function ProfileForm({ init }: { init: ProfileInit }) {
  const router = useRouter()
  const [nombre, setNombre] = useState(init.nombre)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const sinCambios = nombre.trim() === init.nombre.trim() || nombre.trim() === ''

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setMsg(null)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim() }),
      })
      if (res.ok) {
        setMsg({ tipo: 'ok', texto: 'Cambios guardados' })
        router.refresh()
      } else {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        setMsg({ tipo: 'error', texto: j?.error?.message ?? 'No se pudo guardar' })
      }
    } catch {
      setMsg({ tipo: 'error', texto: 'Error de red. Intenta de nuevo.' })
    } finally {
      setGuardando(false)
    }
  }

  const alta = new Date(init.creadoEn).toLocaleDateString('es', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl font-bold tracking-tight">Tu perfil</h1>
      <p className="mt-1 text-muted">Administra tu información personal.</p>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-5 rounded-2xl border-2 border-line bg-white p-6"
      >
        {/* Nombre (editable) */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">Nombre</span>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={120}
            placeholder="Tu nombre"
            className="w-full rounded-xl border-2 border-line bg-bg px-3.5 py-2.5 text-ink outline-none transition-colors placeholder:text-faint focus:border-brand"
          />
        </label>

        {/* Email (solo lectura) */}
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink">Email</span>
          <div className="flex items-center justify-between rounded-xl border-2 border-line bg-surface px-3.5 py-2.5 text-muted">
            <span className="font-mono text-sm">{init.email}</span>
            <span className="text-xs text-faint">No editable</span>
          </div>
        </div>

        {/* Metadatos */}
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted">
          <span>
            Rol:{' '}
            <strong className="text-ink">
              {init.rol === 'admin' ? 'Administrador' : 'Estudiante'}
            </strong>
          </span>
          <span>
            Miembro desde: <strong className="text-ink">{alta}</strong>
          </span>
        </div>

        {msg && (
          <p
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              msg.tipo === 'ok' ? 'bg-good/10 text-good' : 'bg-bad/10 text-bad'
            }`}
          >
            {msg.texto}
          </p>
        )}

        <button
          type="submit"
          disabled={guardando || sinCambios}
          className={buttonStyles('primary', 'md')}
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>

      <p className="mt-4 text-sm text-faint">
        Pronto podrás añadir foto, bio e información de contacto.
      </p>
    </div>
  )
}

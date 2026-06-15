'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { buttonStyles } from '@/components/ui/button'

type Mode = 'login' | 'register'

/** Formulario de inicio de sesión / registro (auth nativo del BFF). */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const esRegistro = mode === 'register'

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch(esRegistro ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(esRegistro ? { name: nombre, email, password } : { email, password }),
      })
      if (res.ok) {
        router.push('/panel')
        router.refresh()
        return
      }
      const j = (await res.json().catch(() => null)) as { error?: string } | null
      setError(j?.error ?? 'No se pudo completar la operación')
      setEnviando(false)
    } catch {
      setError('Error de red. Intenta de nuevo.')
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-gradient-brand font-display text-3xl font-bold tracking-tight"
          >
            CertReady
          </Link>
          <h1 className="mt-6 font-display text-2xl font-bold">
            {esRegistro ? 'Crea tu cuenta' : 'Inicia sesión'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {esRegistro ? 'Empieza a prepararte para tu certificación.' : 'Bienvenido de vuelta.'}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border-2 border-line bg-white p-6 shadow-[0_4px_0_0_rgb(var(--line-strong))]"
        >
          {esRegistro && (
            <Field
              label="Nombre"
              type="text"
              value={nombre}
              onChange={setNombre}
              autoComplete="name"
              placeholder="Tu nombre"
            />
          )}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            placeholder="tu@email.com"
            required
          />
          <Field
            label="Contraseña"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={esRegistro ? 'new-password' : 'current-password'}
            placeholder={esRegistro ? 'Mínimo 8 caracteres' : '••••••••'}
            required
          />

          {error && (
            <p className="rounded-lg bg-bad/10 px-3 py-2 text-sm font-medium text-bad">{error}</p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className={`${buttonStyles('primary', 'lg')} w-full`}
          >
            {enviando ? 'Un momento…' : esRegistro ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {esRegistro ? (
            <>
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="font-semibold text-brand hover:underline">
                Inicia sesión
              </Link>
            </>
          ) : (
            <>
              ¿No tienes cuenta?{' '}
              <Link href="/registro" className="font-semibold text-brand hover:underline">
                Regístrate
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
  required,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border-2 border-line bg-bg px-3.5 py-2.5 text-ink outline-none transition-colors placeholder:text-faint focus:border-brand"
      />
    </label>
  )
}

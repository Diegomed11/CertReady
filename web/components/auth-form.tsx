'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import '@/app/auth.css'

type Mode = 'login' | 'register'

const EMAIL_RE =
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

/**
 * AuthForm — panel animado de inicio de sesión / registro (auth nativo del BFF).
 * Fondo de partículas, etiquetas flotantes y tema claro/oscuro local. Sin
 * "recuérdame" / "olvidé contraseña" / logins sociales (se añadirán después).
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const esRegistro = mode === 'register'

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailValido, setEmailValido] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [oscuro, setOscuro] = useState(false)

  const nombreFocus = useState(false)
  const emailFocus = useState(false)
  const passFocus = useState(false)

  // Tema inicial según preferencia del sistema (scopeado a esta pantalla).
  useEffect(() => {
    setOscuro(window.matchMedia('(prefers-color-scheme: dark)').matches)
  }, [])

  function onEmail(v: string) {
    setEmail(v)
    setEmailValido(v ? EMAIL_RE.test(v.toLowerCase()) : true)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email.toLowerCase())) {
      setEmailValido(false)
      return
    }
    if (esRegistro && password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
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
    <div className={`cr-auth ${oscuro ? 'dark' : 'light'}`}>
      <ParticlesCanvas oscuro={oscuro} />

      <button
        type="button"
        className="theme-toggle"
        onClick={() => setOscuro((v) => !v)}
        aria-label={oscuro ? 'Tema claro' : 'Tema oscuro'}
      >
        {oscuro ? <SunIcon /> : <MoonIcon />}
      </button>

      <div className="login-card">
        <div className="login-card-inner">
          <div className="login-header">
            <Link href="/" className="login-brand">
              CertReady
            </Link>
            <h1>{esRegistro ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}</h1>
            <p>
              {esRegistro
                ? 'Regístrate para empezar a prepararte.'
                : 'Inicia sesión para continuar.'}
            </p>
          </div>

          <form className="login-form" onSubmit={onSubmit} noValidate>
            {esRegistro && (
              <FloatingField
                id="nombre"
                label="Nombre"
                type="text"
                value={nombre}
                onChange={setNombre}
                focusState={nombreFocus}
                autoComplete="name"
              />
            )}

            <FloatingField
              id="email"
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={onEmail}
              focusState={emailFocus}
              autoComplete="email"
              invalid={!emailValido && !!email}
              error={!emailValido && email ? 'Escribe un correo válido' : undefined}
              required
            />

            <FloatingField
              id="password"
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={setPassword}
              focusState={passFocus}
              autoComplete={esRegistro ? 'new-password' : 'current-password'}
              required
              trailing={
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }
            />

            {error && <p className="form-alert">{error}</p>}

            <button type="submit" className="login-button" disabled={enviando}>
              {enviando ? 'Un momento…' : esRegistro ? 'Crear cuenta' : 'Entrar'}
            </button>
          </form>

          <p className="signup-prompt">
            {esRegistro ? (
              <>
                ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
              </>
            ) : (
              <>
                ¿No tienes cuenta? <Link href="/registro">Regístrate</Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Campo con etiqueta flotante. `focusState` es un useState [bool, setter]. */
function FloatingField({
  id,
  label,
  type,
  value,
  onChange,
  focusState,
  autoComplete,
  invalid = false,
  error,
  required = false,
  trailing,
}: {
  id: string
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  focusState: [boolean, React.Dispatch<React.SetStateAction<boolean>>]
  autoComplete: string
  invalid?: boolean
  error?: string
  required?: boolean
  trailing?: React.ReactNode
}) {
  const [focused, setFocused] = focusState
  const activo = focused || value.length > 0
  return (
    <div className={`form-field ${activo ? 'active' : ''} ${invalid ? 'invalid' : ''}`}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        required={required}
      />
      <label htmlFor={id}>{label}</label>
      {trailing}
      {error && <span className="error-message">{error}</span>}
    </div>
  )
}

/** Fondo de partículas (canvas). Color según el tema. */
function ParticlesCanvas({ oscuro }: { oscuro: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const n = Math.min(90, Math.floor((canvas.width * canvas.height) / 16000))
    const parts = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      s: Math.random() * 2.5 + 1,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      a: Math.random() * 0.22,
    }))
    const rgb = oscuro ? '255,255,255' : '75,91,240'

    let raf = 0
    const frame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of parts) {
        p.x += p.vx
        p.y += p.vy
        if (p.x > canvas.width) p.x = 0
        if (p.x < 0) p.x = canvas.width
        if (p.y > canvas.height) p.y = 0
        if (p.y < 0) p.y = canvas.height
        ctx.fillStyle = `rgba(${rgb},${p.a})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2)
        ctx.fill()
      }
      if (!reduce) raf = requestAnimationFrame(frame)
    }
    frame()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [oscuro])

  return <canvas ref={ref} className="particles-canvas" aria-hidden="true" />
}

// --- íconos inline (sin dependencia) ---------------------------------------

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

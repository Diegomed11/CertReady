import { buttonStyles } from '@/components/ui/button'
import { Container } from '@/components/ui/container'

/**
 * Página mostrada cuando el inicio de sesión no se completa (callback inválido,
 * estado/PKCE no coincide, etc.). Ofrece reintentar el flujo.
 */
export default function AuthErrorPage() {
  return (
    <Container className="flex min-h-screen max-w-md flex-col items-center justify-center gap-4 text-center">
      <span className="text-5xl" role="img" aria-hidden="true">
        🔒
      </span>
      <h1 className="font-display text-3xl font-bold tracking-tight">No se pudo iniciar sesión</h1>
      <p className="text-sm text-muted">
        Hubo un problema al completar el inicio de sesión. Vuelve a intentarlo.
      </p>
      <a href="/api/auth/login" className={buttonStyles('primary', 'md')}>
        Reintentar
      </a>
    </Container>
  )
}

import Link from 'next/link'

import { buttonStyles } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { SectionLabel } from '@/components/ui/section-label'
import { getSession, isAuthenticated } from '@/lib/auth/session'

const superficies = [
  { icon: '📜', t: 'Certificaciones', d: 'Elige tu objetivo y arma tu ruta.' },
  { icon: '📖', t: 'Estudio', d: 'Material por tema, a tu ritmo.' },
  { icon: '📝', t: 'Exámenes', d: 'Simulacros cronometrados, con puntaje y repaso.' },
  { icon: '💻', t: 'Entrevistas', d: 'Problemas de código evaluados al instante.' },
  { icon: '📊', t: 'Readiness', d: 'Tu probabilidad de aprobar y el siguiente paso.' },
]

/** Portada pública. Presenta la plataforma y enruta al panel o al inicio de sesión. */
export default async function HomePage() {
  const session = await getSession()
  const autenticado = isAuthenticated(session)
  const ctaHref = autenticado ? '/panel' : '/api/auth/login'
  const ctaText = autenticado ? 'Ir al panel' : 'Empieza ahora'

  return (
    <div className="flex min-h-screen flex-col">
      <header>
        <Container className="flex items-center justify-between py-5">
          <span className="text-gradient-brand font-display text-2xl font-bold">CertReady</span>
          <Link href={ctaHref} className={buttonStyles('ghost', 'sm')}>
            {autenticado ? 'Panel' : 'Iniciar sesión'}
          </Link>
        </Container>
      </header>

      <main className="flex-1">
        <Container className="grid items-center gap-10 py-12 lg:grid-cols-2 lg:gap-16 lg:py-20">
          <div className="flex justify-center">
            {/* Espacio para ilustración/gif: reemplazar el emoji por <img src="/hero.gif" />. */}
            <div className="relative aspect-square w-full max-w-sm">
              <div className="bg-gradient-brand absolute inset-0 rounded-[2.5rem] opacity-10" />
              <div className="absolute inset-5 flex items-center justify-center rounded-[2rem] border-2 border-line bg-white">
                <span className="animate-bob text-8xl" role="img" aria-label="Graduación">
                  🎓
                </span>
              </div>
            </div>
          </div>

          <div className="text-center lg:text-left">
            <SectionLabel>Certificaciones · Entrevistas</SectionLabel>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Aprende, practica y <span className="text-gradient-brand">certifícate</span>.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted lg:mx-0">
              Estudia a tu ritmo, simula el examen real y practica entrevistas de código con
              corrección automática. CertReady te dice cuándo estás listo.
            </p>
            <div className="mt-8 flex justify-center lg:justify-start">
              <Link href={ctaHref} className={buttonStyles('primary', 'lg')}>
                {ctaText}
              </Link>
            </div>
          </div>
        </Container>

        <section className="border-t-2 border-line bg-surface">
          <Container className="py-16">
            <div className="text-center">
              <SectionLabel>Todo en un solo lugar</SectionLabel>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Una ruta, de principio a fin
              </h2>
            </div>
            <ul className="mx-auto mt-10 grid max-w-4xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {superficies.map((s, i) => (
                <li key={s.t} className="animate-pop" style={{ animationDelay: `${i * 80}ms` }}>
                  <Card interactive className="h-full p-6">
                    <span className="text-4xl" role="img" aria-hidden="true">
                      {s.icon}
                    </span>
                    <h3 className="mt-4 font-display text-xl font-semibold">{s.t}</h3>
                    <p className="mt-1 text-sm text-muted">{s.d}</p>
                  </Card>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      </main>

      <footer className="border-t-2 border-line">
        <Container className="flex flex-col items-center justify-between gap-2 py-6 text-sm text-faint sm:flex-row">
          <span className="font-display font-semibold text-muted">CertReady</span>
          <span>Todos los derechos reservados</span>
        </Container>
      </footer>
    </div>
  )
}

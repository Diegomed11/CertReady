import Link from 'next/link'

import { LandingScene } from '@/components/landing-scene'
import { buttonStyles } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { SectionLabel } from '@/components/ui/section-label'
import { getSession, isAuthenticated } from '@/lib/auth/session'

/** Secciones de funciones que se recorren al bajar (estilo alternado). */
const features = [
  {
    key: 'certificaciones',
    emoji: '📜',
    label: 'Certificaciones',
    title: 'Tu certificación, tu ruta',
    desc: 'Explora las certificaciones más demandadas del mercado y elige tu objetivo. Te inscribes y CertReady arma una ruta de estudio paso a paso, con todo lo que necesitas en un solo lugar.',
    bullets: [
      'Catálogo por proveedor y nivel',
      'Inscripción en un clic',
      'Tu ruta siempre a la vista',
    ],
  },
  {
    key: 'estudio',
    emoji: '📖',
    label: 'Estudio',
    title: 'Aprende a tu ritmo',
    desc: 'Material claro y organizado por tema, pensado para que entiendas de verdad. Lee, repasa y avanza cuando quieras, desde donde quieras, sin presión.',
    bullets: [
      'Lecturas por tema y dificultad',
      'Repaso a tu propio ritmo',
      'Desde cualquier dispositivo',
    ],
  },
  {
    key: 'examenes',
    emoji: '📝',
    label: 'Exámenes',
    title: 'Simula el examen real',
    desc: 'Practica con simulacros cronometrados que se sienten como el examen de verdad. Recibe tu puntaje al instante y repasa cada pregunta con explicaciones que sí se entienden.',
    bullets: ['Simulacros cronometrados', 'Puntaje inmediato', 'Repaso con explicaciones'],
  },
  {
    key: 'entrevistas',
    emoji: '💻',
    label: 'Entrevistas',
    title: 'Llega listo a la entrevista',
    desc: 'Resuelve problemas de código que se evalúan automáticamente contra casos de prueba, y repasa las preguntas más frecuentes por puesto y área para llegar con confianza.',
    bullets: [
      'Editor con corrección automática',
      'Casos de prueba al instante',
      'Banco de preguntas por puesto',
    ],
  },
  {
    key: 'progreso',
    emoji: '📊',
    label: 'Progreso',
    title: 'Sabe cuándo estás listo',
    desc: 'CertReady estima tu probabilidad de aprobar a partir de tu desempeño real y te dice exactamente qué estudiar después para mejorar más rápido.',
    bullets: ['Probabilidad de aprobar', 'Dominio por tema', 'Tu siguiente mejor paso'],
  },
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
        {/* Hero */}
        <Container className="grid items-center gap-8 py-12 lg:grid-cols-[1.25fr_1fr] lg:gap-12 lg:py-20">
          <div className="w-full lg:-ml-6">
            {/* Escena 3D (Three.js); cae a la ilustración SVG si no hay WebGL. */}
            <LandingScene name="hero" hero className="aspect-[16/10] w-full" />
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

        {/* Secciones de funciones, alternadas como en apps de aprendizaje */}
        <section className="border-t-2 border-line">
          <Container className="space-y-20 py-16 sm:space-y-28 sm:py-24">
            {features.map((f, i) => {
              const mediaRight = i % 2 === 0
              return (
                <div key={f.key} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
                  <div className={mediaRight ? '' : 'lg:order-2'}>
                    <SectionLabel>{f.label}</SectionLabel>
                    <h2 className="text-gradient-brand mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                      {f.title}
                    </h2>
                    <p className="mt-4 max-w-md text-lg text-muted">{f.desc}</p>
                    <ul className="mt-5 space-y-2.5">
                      {f.bullets.map((b) => (
                        <li key={b} className="flex items-center gap-3 text-muted">
                          <span className="bg-brand/10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-brand">
                            ✓
                          </span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={mediaRight ? '' : 'lg:order-1'}>
                    {/* Escena 3D de la sección; cae a la ilustración SVG sin WebGL. */}
                    <LandingScene
                      name={f.key}
                      className="mx-auto aspect-[4/3] w-full max-w-[420px]"
                    />
                  </div>
                </div>
              )
            })}
          </Container>
        </section>

        {/* Cierre con CTA */}
        <section className="border-t-2 border-line bg-surface">
          <Container className="py-16 text-center sm:py-20">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              ¿Listo para empezar?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">
              Crea tu cuenta y empieza a prepararte hoy mismo.
            </p>
            <div className="mt-7 flex justify-center">
              <Link href={ctaHref} className={buttonStyles('primary', 'lg')}>
                {ctaText}
              </Link>
            </div>
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

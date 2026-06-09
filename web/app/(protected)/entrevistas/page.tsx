import Link from 'next/link'

import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { requireSession } from '@/lib/auth/guard'

const SECCIONES = [
  {
    href: '/entrevistas/problemas',
    emoji: '💻',
    titulo: 'Problemas de código',
    desc: 'Resuelve ejercicios tipo entrevista y ejecútalos contra el juez automático.',
  },
  {
    href: '/entrevistas/preguntas',
    emoji: '🗣️',
    titulo: 'Preguntas y respuestas',
    desc: 'Repasa preguntas conceptuales y de comportamiento por puesto y área.',
  },
]

/** Hub de preparación de entrevistas: problemas de código y banco de Q&A. */
export default async function EntrevistasPage() {
  await requireSession()
  return (
    <div className="space-y-10">
      <PageHeader
        label={<SectionLabel>Entrevistas</SectionLabel>}
        title="Prepárate para la entrevista"
        lead="Practica programación con feedback automático y repasa las preguntas más frecuentes."
      />

      <ul className="grid gap-5 sm:grid-cols-2">
        {SECCIONES.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="block h-full">
              <Card interactive className="flex h-full flex-col p-8">
                <span className="text-5xl">{s.emoji}</span>
                <h2 className="mt-4 font-display text-2xl font-semibold">{s.titulo}</h2>
                <p className="mt-2 text-sm text-muted">{s.desc}</p>
                <span className="mt-6 text-sm font-bold text-brand">Empezar →</span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

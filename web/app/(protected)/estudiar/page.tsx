import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { listContent } from '@/lib/api/services'
import type { Material } from '@/lib/api/types'
import { requireSession } from '@/lib/auth/guard'

/** Resumen de texto plano para la tarjeta (quita marcas de markdown). */
function resumen(m: Material): string {
  const txt = m.contenido
    .replace(/[#*_`>[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return txt.length > 140 ? `${txt.slice(0, 140)}…` : txt
}

/** Material de estudio: lista de lecturas para repasar por tema. */
export default async function EstudiarPage() {
  await requireSession()
  const materiales = await listContent({ limit: 100 })

  return (
    <div className="space-y-10">
      <PageHeader
        label={<SectionLabel>Estudiar</SectionLabel>}
        title="Material de estudio"
        lead="Lee y repasa por tema, a tu ritmo."
      />

      {materiales.data.length === 0 ? (
        <EmptyState title="Aún no hay material">
          Vuelve pronto: estamos preparando contenido para tus certificaciones.
        </EmptyState>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {materiales.data.map((m) => (
            <li key={m.id}>
              <Link href={`/estudiar/${m.id}`} className="block h-full">
                <Card interactive className="flex h-full flex-col p-6">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="brand">{m.certificacion}</Badge>
                    <Badge tone="neutral">{m.tema}</Badge>
                  </div>
                  <h2 className="mt-4 font-display text-xl font-semibold">{m.titulo}</h2>
                  <p className="mt-2 line-clamp-3 text-sm text-muted">{resumen(m)}</p>
                  <span className="mt-4 text-sm font-bold text-brand">Leer →</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

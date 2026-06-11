import { PageHeader } from '@/components/ui/page-header'
import { SectionLabel } from '@/components/ui/section-label'
import { requireSession } from '@/lib/auth/guard'

import { CvRecommender } from './cv-recommender'

/**
 * Mi camino: el usuario sube su CV y el DSS (embeddings locales) detecta su perfil
 * y propone los mejores caminos de certificación. El CV no se almacena.
 */
export default async function RecomendacionesPage() {
  await requireSession()
  return (
    <div className="space-y-8">
      <PageHeader
        label={<SectionLabel>Mi camino</SectionLabel>}
        title="¿Qué certificación sigue para ti?"
        lead="Sube tu CV y te proponemos los mejores caminos de certificación según tu perfil, experiencia y área."
      />
      <CvRecommender />
    </div>
  )
}

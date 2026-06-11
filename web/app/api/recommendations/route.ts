/**
 * POST /api/recommendations — recomienda certificaciones a partir del CV subido.
 *
 * Recibe el archivo (multipart/form-data), lo reenvía al DSS (capa de datos) que
 * extrae el texto, detecta el perfil con embeddings locales y devuelve los caminos
 * sugeridos. El CV no se persiste en ningún punto.
 */
import { NextResponse } from 'next/server'

import { ApiError } from '@/lib/api/client'
import { getRecommendations } from '@/lib/api/services'
import { getSession } from '@/lib/auth/session'

const MAX_BYTES = 5 * 1024 * 1024

export async function POST(req: Request) {
  const session = await getSession()
  if (!session.subject) {
    return NextResponse.json(
      { error: { code: 'no_autenticado', message: 'inicia sesión' } },
      { status: 401 },
    )
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: { code: 'cuerpo_invalido', message: 'sube tu CV (PDF o DOCX)' } },
      { status: 400 },
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: { code: 'muy_grande', message: 'el archivo supera 5 MB' } },
      { status: 413 },
    )
  }

  try {
    const data = await getRecommendations(file)
    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        err.body ?? { error: { code: 'dss', message: 'fallo del análisis' } },
        {
          status: err.status,
        },
      )
    }
    return NextResponse.json(
      { error: { code: 'error_interno', message: 'no se pudo analizar el CV' } },
      { status: 502 },
    )
  }
}

/**
 * Llamadas tipadas a los servicios Go desde el BFF.
 *
 * Centraliza las URLs y los contratos para que tanto los Server Components (que
 * leen datos en el render) como las rutas /api (que atienden mutaciones del
 * cliente) usen las mismas funciones. Solo se ejecuta en el servidor.
 */
import { env } from '@/lib/env'
import { ApiError, fetchJSON } from './client'
import type { Certificacion, Cuenta, Inscripcion, Material, PaginatedList } from './types'

/** Lista vacía reutilizable cuando un endpoint responde 204/sin cuerpo. */
function listaVacia<T>(): PaginatedList<T> {
  return { data: [], count: 0, next_offset: null }
}

/** requireUrl devuelve la base URL de un servicio opcional o falla con claridad. */
function requireUrl(nombre: string, valor: string | undefined): string {
  if (!valor) throw new Error(`falta la variable ${nombre} (servicio no configurado)`)
  return valor
}

function querystring(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

/** Opciones de filtrado y paginación del catálogo. */
export interface ListCertOptions {
  accessToken?: string
  proveedor?: string
  nivel?: string
  limit?: number
  offset?: number
}

/** listCertifications devuelve la página de certificaciones del catálogo. */
export async function listCertifications(
  opts: ListCertOptions = {},
): Promise<PaginatedList<Certificacion>> {
  const qs = new URLSearchParams()
  if (opts.proveedor) qs.set('proveedor', opts.proveedor)
  if (opts.nivel) qs.set('nivel', opts.nivel)
  if (opts.limit !== undefined) qs.set('limit', String(opts.limit))
  if (opts.offset !== undefined) qs.set('offset', String(opts.offset))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''

  const data = await fetchJSON<PaginatedList<Certificacion>>({
    baseURL: env().CATALOG_BASE_URL,
    path: `/v1/certifications${suffix}`,
    accessToken: opts.accessToken,
  })
  return data ?? listaVacia<Certificacion>()
}

/** getMe devuelve la cuenta del usuario autenticado (la provisiona si es su primer acceso). */
export async function getMe(accessToken: string): Promise<Cuenta> {
  const data = await fetchJSON<Cuenta>({
    baseURL: env().USERS_BASE_URL,
    path: '/v1/me',
    accessToken,
  })
  if (!data) throw new Error('respuesta vacía de users /v1/me')
  return data
}

/** listMyEnrollments devuelve las inscripciones del usuario autenticado. */
export async function listMyEnrollments(accessToken: string): Promise<PaginatedList<Inscripcion>> {
  const data = await fetchJSON<PaginatedList<Inscripcion>>({
    baseURL: env().ENROLLMENTS_BASE_URL,
    path: '/v1/me/enrollments',
    accessToken,
  })
  return data ?? listaVacia<Inscripcion>()
}

/** Cuerpo para crear una inscripción. */
export interface NuevaInscripcion {
  tipo_objetivo: 'certificacion' | 'pista'
  objetivo_id: string
}

/** createEnrollment inscribe al usuario autenticado en un objetivo del catálogo. */
export async function createEnrollment(
  accessToken: string,
  body: NuevaInscripcion,
): Promise<Inscripcion> {
  const data = await fetchJSON<Inscripcion>({
    baseURL: env().ENROLLMENTS_BASE_URL,
    path: '/v1/enrollments',
    method: 'POST',
    accessToken,
    body,
  })
  if (!data) throw new Error('respuesta vacía al crear inscripción')
  return data
}

/** deleteEnrollment elimina una inscripción propia del usuario autenticado. */
export async function deleteEnrollment(accessToken: string, id: string): Promise<void> {
  await fetchJSON({
    baseURL: env().ENROLLMENTS_BASE_URL,
    path: `/v1/enrollments/${encodeURIComponent(id)}`,
    method: 'DELETE',
    accessToken,
  })
}

// --- content ---------------------------------------------------------------

/** Opciones de filtrado y paginación del material de estudio. */
export interface ListContentOptions {
  accessToken?: string
  certificacion?: string
  tema?: string
  limit?: number
  offset?: number
}

/** listContent devuelve la página de material de estudio (servicio content). */
export async function listContent(opts: ListContentOptions = {}): Promise<PaginatedList<Material>> {
  const suffix = querystring({
    certificacion: opts.certificacion,
    tema: opts.tema,
    limit: opts.limit,
    offset: opts.offset,
  })
  const data = await fetchJSON<PaginatedList<Material>>({
    baseURL: requireUrl('CONTENT_BASE_URL', env().CONTENT_BASE_URL),
    path: `/v1/content${suffix}`,
    accessToken: opts.accessToken,
  })
  return data ?? listaVacia<Material>()
}

/** getContent devuelve un material por id, o null si no existe (404). */
export async function getContent(id: string, accessToken?: string): Promise<Material | null> {
  try {
    return await fetchJSON<Material>({
      baseURL: requireUrl('CONTENT_BASE_URL', env().CONTENT_BASE_URL),
      path: `/v1/content/${encodeURIComponent(id)}`,
      accessToken,
    })
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

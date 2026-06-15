/**
 * Llamadas tipadas a los servicios Go desde el BFF.
 *
 * Centraliza las URLs y los contratos para que tanto los Server Components (que
 * leen datos en el render) como las rutas /api (que atienden mutaciones del
 * cliente) usen las mismas funciones. Solo se ejecuta en el servidor.
 */
import { env } from '@/lib/env'
import { ApiError, fetchJSON } from './client'
import type {
  Analitica,
  Certificacion,
  Corrida,
  Cuenta,
  Inscripcion,
  Material,
  PaginatedList,
  Problema,
  PreguntaQA,
  Progreso,
  Readiness,
  Recomendaciones,
  RespuestaCorrida,
  ResultadoExamen,
  RevisionSesion,
  SesionConPreguntas,
  SesionExamen,
  Tema,
  TemaProgreso,
  Usuario,
} from './types'

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

/** listUsers devuelve una página de usuarios (solo admin: el backend exige rol admin). */
export async function listUsers(
  accessToken: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<PaginatedList<Usuario>> {
  const data = await fetchJSON<PaginatedList<Usuario>>({
    baseURL: env().USERS_BASE_URL,
    path: `/v1/users${querystring({ limit: opts.limit, offset: opts.offset })}`,
    accessToken,
  })
  return data ?? listaVacia<Usuario>()
}

/** Campos editables del propio perfil (PATCH /v1/me). nil = no cambiar. */
export interface ActualizarPerfil {
  nombre?: string
  bio?: string
  pais?: string
  avatar_url?: string
}

/** updateMe actualiza el perfil del usuario autenticado. */
export async function updateMe(accessToken: string, body: ActualizarPerfil): Promise<Cuenta> {
  const data = await fetchJSON<Cuenta>({
    baseURL: env().USERS_BASE_URL,
    path: '/v1/me',
    method: 'PATCH',
    accessToken,
    body,
  })
  if (!data) throw new Error('respuesta vacía de users PATCH /v1/me')
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

// --- exams -----------------------------------------------------------------

/** listMyExams devuelve las sesiones de examen del usuario autenticado. */
export async function listMyExams(
  accessToken: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<PaginatedList<SesionExamen>> {
  const suffix = querystring({ limit: opts.limit, offset: opts.offset })
  const data = await fetchJSON<PaginatedList<SesionExamen>>({
    baseURL: requireUrl('EXAMS_BASE_URL', env().EXAMS_BASE_URL),
    path: `/v1/me/exams${suffix}`,
    accessToken,
  })
  return data ?? listaVacia<SesionExamen>()
}

/** Cuerpo para iniciar un simulacro, un quiz de tema (`tema`) o de sección (`temas`). */
export interface NuevaSesionExamen {
  certificacion: string
  tema?: string
  temas?: string[]
  /** Muestreo ponderado por dominio: una cuota de preguntas por grupo de temas. */
  grupos?: { temas: string[]; n: number }[]
  num_preguntas?: number
  modo?: 'simulacro' | 'practica'
}

/** Pesos oficiales de los dominios del examen SAA-C03. */
const PESOS_DOMINIO: Record<string, number> = {
  Seguridad: 0.3,
  Resiliencia: 0.26,
  Rendimiento: 0.24,
  Costos: 0.2,
}

/**
 * gruposPonderados reparte `total` preguntas entre los dominios según su peso real
 * (los temas se agrupan por su `dominio`). Ajusta el redondeo para que la suma dé
 * exactamente `total`.
 */
export function gruposPonderados(temas: Tema[], total: number): { temas: string[]; n: number }[] {
  const orden: string[] = []
  const porDom = new Map<string, string[]>()
  for (const t of temas) {
    const d = t.dominio ?? 'General'
    if (!porDom.has(d)) {
      porDom.set(d, [])
      orden.push(d)
    }
    porDom.get(d)!.push(t.slug)
  }
  if (orden.length === 0) return []

  const grupos = orden.map((d) => ({
    temas: porDom.get(d)!,
    n: Math.max(1, Math.round((PESOS_DOMINIO[d] ?? 1 / orden.length) * total)),
  }))
  // Ajusta el redondeo para cuadrar la suma con `total`.
  let suma = grupos.reduce((s, g) => s + g.n, 0)
  for (let i = 0; suma !== total && i < 1000; i++) {
    const g = grupos[i % grupos.length]!
    if (suma < total) {
      g.n++
      suma++
    } else if (g.n > 1) {
      g.n--
      suma--
    }
  }
  return grupos
}

/** createExamSession inicia un simulacro y devuelve la sesión con sus preguntas. */
export async function createExamSession(
  accessToken: string,
  body: NuevaSesionExamen,
): Promise<SesionConPreguntas> {
  const data = await fetchJSON<SesionConPreguntas>({
    baseURL: requireUrl('EXAMS_BASE_URL', env().EXAMS_BASE_URL),
    path: '/v1/exams/sessions',
    method: 'POST',
    accessToken,
    body,
  })
  if (!data) throw new Error('respuesta vacía al crear la sesión de examen')
  return data
}

/**
 * createSimulacroPonderado crea un examen con el reparto de preguntas por dominio
 * del examen real (pesos SAA-C03 30/26/24/20). Resuelve los temas de la
 * certificación y arma los grupos; si no hay temas, cae a un muestreo uniforme. El
 * muestreo es aleatorio (`$sample`), así que cada examen rota las preguntas.
 */
export async function createSimulacroPonderado(
  accessToken: string,
  certSlug: string,
  total: number,
): Promise<SesionConPreguntas> {
  const cert = await getCertification(certSlug, accessToken)
  const temas = cert ? await listTopics(cert.id, accessToken) : []
  const grupos = gruposPonderados(temas, total)
  return createExamSession(accessToken, {
    certificacion: certSlug,
    grupos: grupos.length > 0 ? grupos : undefined,
    num_preguntas: total,
    modo: 'simulacro',
  })
}

/** getExamSession devuelve una sesión propia (preguntas si en curso, resultado si finalizada). */
export async function getExamSession(
  accessToken: string,
  id: string,
): Promise<RevisionSesion | null> {
  try {
    return await fetchJSON<RevisionSesion>({
      baseURL: requireUrl('EXAMS_BASE_URL', env().EXAMS_BASE_URL),
      path: `/v1/exams/sessions/${encodeURIComponent(id)}`,
      accessToken,
    })
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

/** submitExam entrega las respuestas de una sesión y devuelve el resultado calificado. */
export async function submitExam(
  accessToken: string,
  id: string,
  respuestas: { ref: string; seleccion: string[] }[],
): Promise<ResultadoExamen> {
  const data = await fetchJSON<ResultadoExamen>({
    baseURL: requireUrl('EXAMS_BASE_URL', env().EXAMS_BASE_URL),
    path: `/v1/exams/sessions/${encodeURIComponent(id)}/submit`,
    method: 'POST',
    accessToken,
    body: { respuestas },
  })
  if (!data) throw new Error('respuesta vacía al entregar el examen')
  return data
}

// --- problems / qa ---------------------------------------------------------

/** Opciones de filtrado y paginación del listado de problemas. */
export interface ListProblemsOptions {
  accessToken?: string
  area?: string
  dificultad?: string
  etiqueta?: string
  limit?: number
  offset?: number
}

/** listProblems devuelve la página de problemas de código (vista pública). */
export async function listProblems(
  opts: ListProblemsOptions = {},
): Promise<PaginatedList<Problema>> {
  const suffix = querystring({
    area: opts.area,
    dificultad: opts.dificultad,
    etiqueta: opts.etiqueta,
    limit: opts.limit,
    offset: opts.offset,
  })
  const data = await fetchJSON<PaginatedList<Problema>>({
    baseURL: requireUrl('PROBLEMS_BASE_URL', env().PROBLEMS_BASE_URL),
    path: `/v1/problems${suffix}`,
    accessToken: opts.accessToken,
  })
  return data ?? listaVacia<Problema>()
}

/** getProblem devuelve un problema por id (vista pública), o null si no existe. */
export async function getProblem(id: string, accessToken?: string): Promise<Problema | null> {
  try {
    return await fetchJSON<Problema>({
      baseURL: requireUrl('PROBLEMS_BASE_URL', env().PROBLEMS_BASE_URL),
      path: `/v1/problems/${encodeURIComponent(id)}`,
      accessToken,
    })
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

/** Opciones de filtrado y paginación del listado de Q&A. */
export interface ListQAOptions {
  accessToken?: string
  puesto?: string
  area?: string
  categoria?: string
  limit?: number
  offset?: number
}

/** listQA devuelve la página de preguntas de Q&A de entrevista. */
export async function listQA(opts: ListQAOptions = {}): Promise<PaginatedList<PreguntaQA>> {
  const suffix = querystring({
    puesto: opts.puesto,
    area: opts.area,
    categoria: opts.categoria,
    limit: opts.limit,
    offset: opts.offset,
  })
  const data = await fetchJSON<PaginatedList<PreguntaQA>>({
    baseURL: requireUrl('PROBLEMS_BASE_URL', env().PROBLEMS_BASE_URL),
    path: `/v1/qa${suffix}`,
    accessToken: opts.accessToken,
  })
  return data ?? listaVacia<PreguntaQA>()
}

/** getQA devuelve una pregunta de Q&A por id, o null si no existe. */
export async function getQA(id: string, accessToken?: string): Promise<PreguntaQA | null> {
  try {
    return await fetchJSON<PreguntaQA>({
      baseURL: requireUrl('PROBLEMS_BASE_URL', env().PROBLEMS_BASE_URL),
      path: `/v1/qa/${encodeURIComponent(id)}`,
      accessToken,
    })
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

// --- judge -----------------------------------------------------------------

/** Cuerpo para enviar código al juez. */
export interface EnvioCodigo {
  problema_ref: string
  lenguaje: string
  fuente: string
}

/**
 * submitJudge envía código al juez y devuelve la corrida con su resultado.
 *
 * El juez ejecuta el código en un sandbox (un contenedor por caso), así que la
 * latencia puede superar el timeout por defecto: se usa uno amplio (30 s).
 */
export async function submitJudge(
  accessToken: string,
  body: EnvioCodigo,
): Promise<RespuestaCorrida> {
  const data = await fetchJSON<RespuestaCorrida>({
    baseURL: requireUrl('JUDGE_BASE_URL', env().JUDGE_BASE_URL),
    path: '/v1/judge/runs',
    method: 'POST',
    accessToken,
    body,
    timeoutMs: 30000,
  })
  if (!data) throw new Error('respuesta vacía del juez')
  return data
}

/** listMyRuns devuelve el historial de corridas del usuario autenticado. */
export async function listMyRuns(
  accessToken: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<PaginatedList<Corrida>> {
  const suffix = querystring({ limit: opts.limit, offset: opts.offset })
  const data = await fetchJSON<PaginatedList<Corrida>>({
    baseURL: requireUrl('JUDGE_BASE_URL', env().JUDGE_BASE_URL),
    path: `/v1/me/judge/runs${suffix}`,
    accessToken,
  })
  return data ?? listaVacia<Corrida>()
}

// --- dss / readiness -------------------------------------------------------

/**
 * getReadiness devuelve la preparación estimada del usuario para una
 * certificación, o null si aún no hay datos/intentos (404). El DSS es un servicio
 * de análisis sin auth; el BFF le pasa el subject de la sesión como usuario_id.
 */
export async function getReadiness(
  usuarioId: string,
  certificacion: string,
): Promise<Readiness | null> {
  const suffix = querystring({ certificacion })
  try {
    return await fetchJSON<Readiness>({
      baseURL: requireUrl('DSS_BASE_URL', env().DSS_BASE_URL),
      path: `/v1/readiness/${encodeURIComponent(usuarioId)}${suffix}`,
      timeoutMs: 8000,
    })
  } catch (e) {
    // 404: aún no hay datos/intentos. Si el DSS no está levantado (servicio de
    // análisis opcional, requiere ClickHouse), degradamos a "sin datos" en vez
    // de romper la página: el resto de la app no depende de él.
    if (e instanceof ApiError) {
      if (e.status === 404) return null
      throw e
    }
    return null
  }
}

/**
 * getRecommendations envía el CV (archivo) al DSS y devuelve perfil + caminos.
 *
 * Es multipart (no JSON), así que usa `fetch` directo en vez de `fetchJSON`. El
 * archivo se reenvía tal cual; el DSS lo procesa en memoria y no lo persiste.
 */
export async function getRecommendations(file: File): Promise<Recomendaciones> {
  const fd = new FormData()
  fd.append('file', file, file.name)
  const res = await fetch(requireUrl('DSS_BASE_URL', env().DSS_BASE_URL) + '/v1/recommendations', {
    method: 'POST',
    body: fd,
    cache: 'no-store',
  })
  if (!res.ok) {
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    throw new ApiError(res.status, body)
  }
  return (await res.json()) as Recomendaciones
}

/**
 * getAnalytics devuelve el desempeño del usuario (acierto por tema + tendencia)
 * para los dashboards, o `null` si el DSS/ClickHouse no está disponible. Igual que
 * `getReadiness`, degrada en silencio para no romper la página.
 */
export async function getAnalytics(
  usuarioId: string,
  certificacion: string,
): Promise<Analitica | null> {
  const suffix = querystring({ certificacion })
  try {
    return await fetchJSON<Analitica>({
      baseURL: requireUrl('DSS_BASE_URL', env().DSS_BASE_URL),
      path: `/v1/analytics/${encodeURIComponent(usuarioId)}${suffix}`,
      timeoutMs: 8000,
    })
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    return null
  }
}

// --- catalog: temas (ruta de aprendizaje) ----------------------------------

/** getCertification devuelve una certificación por id o slug, o null si no existe. */
export async function getCertification(
  idOrSlug: string,
  accessToken?: string,
): Promise<Certificacion | null> {
  try {
    return await fetchJSON<Certificacion>({
      baseURL: env().CATALOG_BASE_URL,
      path: `/v1/certifications/${encodeURIComponent(idOrSlug)}`,
      accessToken,
    })
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

/** listTopics devuelve los temas de una certificación, ordenados por `orden`. */
export async function listTopics(certId: string, accessToken?: string): Promise<Tema[]> {
  const data = await fetchJSON<{ data: Tema[]; count: number }>({
    baseURL: env().CATALOG_BASE_URL,
    path: `/v1/certifications/${encodeURIComponent(certId)}/topics`,
    accessToken,
  })
  return data?.data ?? []
}

// --- progress --------------------------------------------------------------

/** getMyProgress devuelve el progreso del usuario en una certificación (clave = slug). */
export async function getMyProgress(accessToken: string, certificacion: string): Promise<Progreso> {
  const suffix = querystring({ certificacion })
  const data = await fetchJSON<Progreso>({
    baseURL: requireUrl('PROGRESS_BASE_URL', env().PROGRESS_BASE_URL),
    path: `/v1/me/progress${suffix}`,
    accessToken,
  })
  return data ?? { lecciones: [], temas: [] }
}

/** completeLesson marca una lección (material) como leída por el usuario. */
export async function completeLesson(
  accessToken: string,
  body: { certificacion: string; tema: string; material_id: string },
): Promise<void> {
  await fetchJSON({
    baseURL: requireUrl('PROGRESS_BASE_URL', env().PROGRESS_BASE_URL),
    path: '/v1/progress/lessons',
    method: 'POST',
    accessToken,
    body,
  })
}

/** completeQuiz registra el resultado del quiz de un tema y devuelve su estado. */
export async function completeQuiz(
  accessToken: string,
  body: { certificacion: string; tema: string; puntaje: number },
): Promise<TemaProgreso> {
  const data = await fetchJSON<TemaProgreso>({
    baseURL: requireUrl('PROGRESS_BASE_URL', env().PROGRESS_BASE_URL),
    path: '/v1/progress/quizzes',
    method: 'POST',
    accessToken,
    body,
  })
  if (!data) throw new Error('respuesta vacía al guardar el quiz')
  return data
}

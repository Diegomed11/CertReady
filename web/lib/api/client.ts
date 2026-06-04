/**
 * Cliente HTTP server-side para los servicios Go (BFF).
 *
 * Las rutas /api de Next obtienen el accessToken de la sesión cifrada y lo
 * pasan a `fetchJSON` para llamar a catalog / users / enrollments. El cliente
 * nunca está disponible en el navegador.
 */

/** ApiError representa un fallo de las llamadas al backend. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `backend respondió ${status}`)
  }
}

/** Opciones de una petición al backend. */
export interface ApiRequest {
  /** Base URL del servicio destino (sin slash final). */
  baseURL: string
  /** Path empezando por `/` (p. ej. "/v1/me"). */
  path: string
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  /** Bearer token a inyectar; opcional para rutas públicas. */
  accessToken?: string
  /** Cuerpo JSON (se serializa); omitir para GET/DELETE. */
  body?: unknown
  /** Cabeceras adicionales (p. ej. X-Request-ID propagado). */
  headers?: Record<string, string>
  /** Timeout en ms (default 5000). */
  timeoutMs?: number
}

/**
 * fetchJSON ejecuta una petición JSON contra el backend y devuelve el cuerpo
 * decodificado, o lanza ApiError con el código y el cuerpo si la respuesta no
 * es 2xx.
 *
 * Returns null en respuestas 204 No Content; el llamador debe contar con eso.
 */
export async function fetchJSON<T>(req: ApiRequest): Promise<T | null> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), req.timeoutMs ?? 5000)

  const headers: Record<string, string> = {
    accept: 'application/json',
    ...req.headers,
  }
  if (req.body !== undefined) headers['content-type'] = 'application/json'
  if (req.accessToken) headers['authorization'] = `Bearer ${req.accessToken}`

  try {
    const res = await fetch(req.baseURL + req.path, {
      method: req.method ?? 'GET',
      headers,
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      signal: ctl.signal,
      // El BFF nunca cachea la respuesta del backend; Next podría hacerlo por defecto.
      cache: 'no-store',
    })

    if (res.status === 204) return null

    const raw = await res.text()
    const parsed: unknown = raw ? JSON.parse(raw) : null

    if (!res.ok) {
      throw new ApiError(res.status, parsed)
    }
    return parsed as T
  } finally {
    clearTimeout(t)
  }
}

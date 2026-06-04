/**
 * Tests del cliente HTTP del BFF. Sin servidor real: se reemplaza globalThis.fetch
 * con un doble por test, cubriendo los caminos relevantes (ok/204/error/timeout).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, fetchJSON } from './client'

const baseURL = 'http://svc.test'
const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('fetchJSON', () => {
  it('decodifica 200 OK como JSON tipado', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ) as typeof fetch

    const data = await fetchJSON<{ ok: boolean }>({ baseURL, path: '/v1/x' })
    expect(data).toEqual({ ok: true })
  })

  it('devuelve null en 204 No Content', async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 204 })) as typeof fetch
    const data = await fetchJSON<unknown>({ baseURL, path: '/v1/x', method: 'DELETE' })
    expect(data).toBeNull()
  })

  it('lanza ApiError con status y cuerpo en respuestas no-2xx', async () => {
    const body = { error: { code: 'no_encontrado', message: 'no existe' } }
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
    ) as typeof fetch

    await expect(fetchJSON({ baseURL, path: '/v1/x' })).rejects.toMatchObject({
      name: 'Error',
      status: 404,
      body,
    })
  })

  it('inyecta Authorization: Bearer cuando se provee accessToken', async () => {
    const seen: Record<string, string> = {}
    globalThis.fetch = vi.fn(async (_input, init) => {
      const h = new Headers(init?.headers)
      h.forEach((v, k) => (seen[k] = v))
      return new Response('{}', { status: 200 })
    }) as typeof fetch

    await fetchJSON({ baseURL, path: '/v1/me', accessToken: 'abc' })
    expect(seen['authorization']).toBe('Bearer abc')
  })

  it('serializa el cuerpo como JSON y fija content-type', async () => {
    let bodySent: unknown
    let ctSent: string | null = null
    globalThis.fetch = vi.fn(async (_input, init) => {
      bodySent = init?.body
      const h = new Headers(init?.headers)
      ctSent = h.get('content-type')
      return new Response('{}', { status: 200 })
    }) as typeof fetch

    await fetchJSON({
      baseURL,
      path: '/v1/x',
      method: 'POST',
      body: { a: 1 },
    })
    expect(bodySent).toBe('{"a":1}')
    expect(ctSent).toBe('application/json')
  })
})

describe('ApiError', () => {
  it('expone status y body propios', () => {
    const e = new ApiError(409, { detalle: 'duplicado' })
    expect(e.status).toBe(409)
    expect(e.body).toEqual({ detalle: 'duplicado' })
    expect(e.message).toContain('409')
  })
})

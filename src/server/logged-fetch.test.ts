import { afterEach, expect, test, vi } from 'vitest'
import type { HttpCapture } from '../core/types'
import type { Logger } from '../core/logger'
import { createLoggedFetch } from './logged-fetch'

afterEach(() => { vi.restoreAllMocks() })

const flush = () => new Promise((r) => setTimeout(r, 10))

function fakeLogger(captured: HttpCapture[]): Logger {
  const noop = () => {}
  return { debug: noop, info: noop, warn: noop, error: noop, http: (c) => { captured.push(c) } }
}

test('records request/response and leaves the caller response readable; redacts headers', async () => {
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })))
  const captured: HttpCapture[] = []
  const f = createLoggedFetch(fakeLogger(captured))
  const res = await f('https://api.test/users', {
    method: 'POST',
    body: JSON.stringify({ name: 'a' }),
    headers: { 'content-type': 'application/json', authorization: 'Bearer secret' },
  })
  expect(await res.json()).toEqual({ ok: true }) // caller body still readable
  await flush()
  expect(captured).toHaveLength(1)
  const c = captured[0]
  expect(c.method).toBe('POST')
  expect(c.status).toBe(200)
  expect(c.request.body).toEqual({ name: 'a' })
  expect(c.response?.body).toEqual({ ok: true })
  expect(c.request.headers.authorization).toBe('[redacted]')
})

test('records an error entry and rethrows on network failure', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
  const captured: HttpCapture[] = []
  const f = createLoggedFetch(fakeLogger(captured))
  await expect(f('https://api.test/down')).rejects.toThrow('fetch failed')
  await flush()
  expect(captured[0].error).toMatchObject({ name: 'TypeError', message: 'fetch failed' })
  expect(captured[0].status).toBeUndefined()
})

test('a capture failure never reaches the caller', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('hi', { status: 200 })))
  const log: Logger = { ...fakeLogger([]), http: () => { throw new Error('boom') } }
  const f = createLoggedFetch(log)
  const res = await f('https://api.test/x')
  expect(res.status).toBe(200)
  expect(await res.text()).toBe('hi')
})

test('truncates bodies over maxBodyBytes', async () => {
  const big = 'x'.repeat(100)
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(big, { status: 200, headers: { 'content-type': 'text/plain' } })))
  const captured: HttpCapture[] = []
  const f = createLoggedFetch(fakeLogger(captured), { maxBodyBytes: 10 })
  const res = await f('https://api.test/big')
  await flush()
  expect(captured[0].truncated).toBe(true)
  expect(String(captured[0].response?.body).length).toBeLessThan(big.length)
  expect(await res.text()).toBe(big) // caller still receives the full, unread body
})

test('GET with no body and a 204 response capture no bodies, and the caller still gets the response', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
  const captured: HttpCapture[] = []
  const f = createLoggedFetch(fakeLogger(captured))
  const res = await f('https://api.test/resource')
  expect(res.status).toBe(204)
  await flush()
  expect(captured[0].request.body).toBeUndefined()
  expect(captured[0].response?.body).toBeUndefined()
})

test('redactBody masks fields before truncation, so secrets do not leak on large bodies', async () => {
  const secretBody = JSON.stringify({ password: 'hunter2', note: 'z'.repeat(200) })
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(secretBody, { status: 200, headers: { 'content-type': 'application/json' } })))
  const captured: HttpCapture[] = []
  const f = createLoggedFetch(fakeLogger(captured), {
    maxBodyBytes: 40,
    redactBody: (body) => {
      if (body && typeof body === 'object' && 'password' in body) {
        return { ...(body as Record<string, unknown>), password: '[redacted]' }
      }
      return body
    },
  })
  await f('https://api.test/login')
  await flush()
  const stored = String(captured[0].response?.body)
  expect(captured[0].truncated).toBe(true)
  expect(stored).not.toContain('hunter2')  // secret masked before truncation
  expect(stored).toContain('[redacted]')
})

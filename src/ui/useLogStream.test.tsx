import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useLogStream } from './useLogStream'

const jsonRes = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

/**
 * URL-aware fetch mock mirroring the three viewer endpoints:
 *   GET  /session  -> { authed }
 *   POST /auth     -> 200/401 (flips authed on success)
 *   GET  /entries  -> successive pages
 */
function makeFetch(opts: {
  authed?: boolean
  authOk?: boolean
  pages?: { entries: { id: string }[]; cursor: string }[]
} = {}) {
  let authed = opts.authed ?? false
  const authOk = opts.authOk ?? true
  const pages = opts.pages ?? [{ entries: [], cursor: '' }]
  let page = 0
  return vi.fn(async (url: string) => {
    if (url.includes('/session')) return jsonRes(200, { authed })
    if (url.includes('/auth')) {
      authed = authOk
      return jsonRes(authOk ? 200 : 401, { ok: authOk })
    }
    if (url.includes('/entries')) {
      const p = pages[Math.min(page, pages.length - 1)]
      page++
      return jsonRes(200, p)
    }
    return jsonRes(404, {})
  })
}

const entriesCalls = (m: { mock: { calls: unknown[][] } }) =>
  m.mock.calls.filter((c) => String(c[0]).includes('/entries'))

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

test('does not poll /entries until authenticated', async () => {
  const fetchMock = makeFetch({ authed: false })
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useLogStream({ basePath: '/api/logs', intervalMs: 1000 }))
  await waitFor(() => expect(result.current.status).toBe('unauthorized'))
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(entriesCalls(fetchMock)).toHaveLength(0)
})

test('polls and accumulates entries once authed, advancing the cursor', async () => {
  const fetchMock = makeFetch({
    authed: true,
    pages: [{ entries: [{ id: '1' }], cursor: '1' }, { entries: [{ id: '2' }], cursor: '2' }],
  })
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useLogStream({ basePath: '/api/logs', intervalMs: 1000 }))
  await waitFor(() => expect(result.current.entries.map((e) => e.id)).toEqual(['1']))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  await waitFor(() => expect(result.current.entries.map((e) => e.id)).toEqual(['1', '2']))
  expect(String(entriesCalls(fetchMock)[1][0])).toContain('since=1')
})

test('authenticate() unlocks and begins polling', async () => {
  const fetchMock = makeFetch({ authed: false, authOk: true, pages: [{ entries: [{ id: '9' }], cursor: '9' }] })
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useLogStream({ basePath: '/api/logs', intervalMs: 1000 }))
  await waitFor(() => expect(result.current.status).toBe('unauthorized'))
  await act(async () => { expect(await result.current.authenticate('shh')).toBe(true) })
  await waitFor(() => expect(result.current.entries.map((e) => e.id)).toEqual(['9']))
  expect(result.current.status).toBe('live')
})

test('authenticate() returns false on a wrong secret and stays locked', async () => {
  const fetchMock = makeFetch({ authed: false, authOk: false })
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useLogStream({ basePath: '/api/logs', intervalMs: 1000 }))
  await waitFor(() => expect(result.current.status).toBe('unauthorized'))
  await act(async () => { expect(await result.current.authenticate('nope')).toBe(false) })
  await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
  expect(entriesCalls(fetchMock)).toHaveLength(0)
})

test('pausing stops further polling', async () => {
  const fetchMock = makeFetch({ authed: true })
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useLogStream({ basePath: '/api/logs', intervalMs: 1000 }))
  await waitFor(() => expect(result.current.status).toBe('live'))
  act(() => result.current.setPaused(true))
  const before = entriesCalls(fetchMock).length
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(entriesCalls(fetchMock).length).toBe(before)
  expect(result.current.status).toBe('paused')
})

test('a 401 from /entries (expired session) drops back to unauthorized', async () => {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/session')) return jsonRes(200, { authed: true })
    if (url.includes('/entries')) return jsonRes(401, { error: 'unauthorized' })
    return jsonRes(404, {})
  })
  vi.stubGlobal('fetch', fetchMock)
  const { result } = renderHook(() => useLogStream({ basePath: '/api/logs', intervalMs: 1000 }))
  await waitFor(() => expect(result.current.status).toBe('unauthorized'))
})

test('a network failure on the session probe surfaces as error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
  const { result } = renderHook(() => useLogStream({ basePath: '/api/logs' }))
  await waitFor(() => expect(result.current.status).toBe('error'))
})

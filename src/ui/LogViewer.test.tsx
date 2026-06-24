import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { LogViewer } from './LogViewer'
import type { ViewerConfig } from '../core/types'

afterEach(() => { vi.restoreAllMocks() })

const config: ViewerConfig = { path: '/logs', basePath: '/api/_logs', intervalMs: 1000 }

const jsonRes = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 400,
  status,
  json: async () => body,
})

function mockFetch(opts: { authed: boolean; entries?: unknown[]; cursor?: string }) {
  return vi.fn(async (url: string) => {
    if (url.includes('/session')) return jsonRes(200, { authed: opts.authed })
    if (url.includes('/entries')) return jsonRes(200, { entries: opts.entries ?? [], cursor: opts.cursor ?? '' })
    return jsonRes(404, {})
  })
}

test('polls config.basePath, renders rows, and expands structured data on click', async () => {
  const fetchMock = mockFetch({
    authed: true,
    entries: [{ id: '1', ts: 1, level: 'info', message: 'hello', data: { userId: 7 } }],
    cursor: '1',
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<LogViewer config={config} />)
  await waitFor(() => expect(screen.getByText('hello')).toBeTruthy())
  // Every request must be built from the configured basePath (single source of truth).
  expect(fetchMock.mock.calls.every((c) => String(c[0]).startsWith('/api/_logs/'))).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: /hello/ }))
  await waitFor(() => expect(screen.getByText(/userId/)).toBeTruthy())
})

test('shows the auth form when the session is not authenticated', async () => {
  vi.stubGlobal('fetch', mockFetch({ authed: false }))
  render(<LogViewer config={config} />)
  await waitFor(() => expect(screen.getByLabelText('secret')).toBeTruthy())
})

test('unlocking with the secret reveals the log stream', async () => {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes('/session')) return jsonRes(200, { authed: false })
    if (url.includes('/auth')) return jsonRes(200, { ok: true })
    if (url.includes('/entries')) return jsonRes(200, { entries: [{ id: '1', ts: 1, level: 'warn', message: 'after unlock' }], cursor: '1' })
    return jsonRes(404, {})
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<LogViewer config={config} />)
  await waitFor(() => expect(screen.getByLabelText('secret')).toBeTruthy())
  fireEvent.change(screen.getByLabelText('secret'), { target: { value: 'shh' } })
  fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
  await waitFor(() => expect(screen.getByText('after unlock')).toBeTruthy())
})

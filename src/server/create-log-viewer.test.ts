import { expect, test } from 'vitest'
import { memoryStore } from '../stores/memory-store'
import { COOKIE_NAME, signToken } from './auth'
import { createLogViewer } from './create-log-viewer'

test('returns a serializable config with sensible defaults', () => {
  const { config } = createLogViewer({ store: memoryStore(), secret: 's' })
  expect(config).toEqual({ path: '/logs', basePath: '/api/logs', intervalMs: 5000 })
})

test('config reflects overrides and never leaks the secret', () => {
  const { config } = createLogViewer({
    store: memoryStore(),
    secret: 'super-secret',
    path: '/admin/logs',
    basePath: '/api/admin/logs',
    intervalMs: 10_000,
  })
  expect(config).toEqual({ path: '/admin/logs', basePath: '/api/admin/logs', intervalMs: 10_000 })
  expect(JSON.stringify(config)).not.toContain('super-secret')
})

test('logged entries are visible through the handlers (shared store)', async () => {
  const { log, handlers } = createLogViewer({ store: memoryStore(), secret: 's', enabledInProduction: true })
  log.info('shared!', { ok: true })
  const req = new Request('http://x/api/_logs/entries', { headers: { cookie: `${COOKIE_NAME}=${signToken('s')}` } })
  const body = await (await handlers.GET(req)).json()
  expect(body.entries).toHaveLength(1)
  expect(body.entries[0].message).toBe('shared!')
})

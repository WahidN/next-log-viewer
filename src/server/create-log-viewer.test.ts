import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'
import type { LogEntry, LogStore } from '../core/types'
import { fileStore } from '../stores/file-store'
import { memoryStore } from '../stores/memory-store'
import { COOKIE_NAME, signToken } from './auth'
import { createLogViewer } from './create-log-viewer'

function capturing(): { store: LogStore; entries: LogEntry[] } {
  const entries: LogEntry[] = []
  return { entries, store: { append: (e) => { entries.push(e) }, query: () => ({ entries, cursor: '' }) } }
}

const httpCapture = { method: 'GET', url: 'https://api.test/x', status: 200, durationMs: 1, request: { headers: {} } }

afterEach(() => { vi.restoreAllMocks() })

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

test('disabled in production: the logger writes nothing to the store', () => {
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    const { store, entries } = capturing()
    // enabledInProduction defaults to false → the viewer (and now logging) is off
    const { log } = createLogViewer({ store, secret: 's' })
    log.info('dropped', { a: 1 })
    log.error('dropped', new Error('x'))
    log.http(httpCapture)
    expect(entries).toHaveLength(0)
  } finally {
    process.env.NODE_ENV = prev
  }
})

test('disabled in production: the logger prints nothing to the console', () => {
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const { log } = createLogViewer({ store: memoryStore(), secret: 's' })
    log.info('quiet')
    log.error('also quiet')
    expect(info).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  } finally {
    process.env.NODE_ENV = prev
  }
})

test('enabled in production: the logger still writes to the store', () => {
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    const { store, entries } = capturing()
    const { log } = createLogViewer({ store, secret: 's', enabledInProduction: true })
    log.info('kept')
    expect(entries).toHaveLength(1)
  } finally {
    process.env.NODE_ENV = prev
  }
})

test('in development the logger writes even when enabledInProduction is unset', () => {
  // NODE_ENV is not 'production' under test — dev/test always logs
  const { store, entries } = capturing()
  const { log } = createLogViewer({ store, secret: 's' })
  log.info('dev log')
  expect(entries).toHaveLength(1)
})

test('disabled in production with a fileStore: nothing is written to disk', () => {
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  const dir = mkdtempSync(join(tmpdir(), 'nlv-disabled-'))
  try {
    const path = join(dir, 'logs', 'app.jsonl')
    const { log } = createLogViewer({ store: fileStore({ path }), secret: 's' })
    log.info('dropped')
    log.http(httpCapture)
    expect(existsSync(path)).toBe(false)
    expect(existsSync(join(dir, 'logs'))).toBe(false) // not even the directory
    expect(readdirSync(dir)).toEqual([])
  } finally {
    process.env.NODE_ENV = prev
  }
})

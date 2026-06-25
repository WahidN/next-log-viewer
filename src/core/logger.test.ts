import { afterEach, expect, test, vi } from 'vitest'
import type { LogEntry, LogStore } from './types'
import { createLogger } from './logger'

function capturing(): { store: LogStore; entries: LogEntry[] } {
  const entries: LogEntry[] = []
  return { entries, store: { append: (e) => { entries.push(e) }, query: () => ({ entries, cursor: '' }) } }
}

afterEach(() => { vi.restoreAllMocks() })

test('records entries with incrementing ids and given clock', () => {
  const { store, entries } = capturing()
  let t = 1000
  const log = createLogger(store, { console: false, now: () => t++ })
  log.info('first', { a: 1 })
  log.error('second', new Error('boom'))
  expect(entries[0]).toMatchObject({ level: 'info', message: 'first', data: { a: 1 } })
  expect(entries[1].error).toMatchObject({ name: 'Error', message: 'boom' })
  expect(entries[0].id < entries[1].id).toBe(true)
})

test('passes through to console by default', () => {
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const { store } = capturing()
  const log = createLogger(store, { now: () => 1 })
  log.warn('careful')
  expect(spy).toHaveBeenCalledWith('careful')
})

test('never throws when the store append fails', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const store: LogStore = { append: () => { throw new Error('disk full') }, query: () => ({ entries: [], cursor: '' }) }
  const log = createLogger(store, { console: false, now: () => 1 })
  expect(() => log.info('x')).not.toThrow()
  expect(() => log.info('y')).not.toThrow()
  expect(warn).toHaveBeenCalledTimes(1) // warns once, not per entry
})

test('never throws when the store append rejects asynchronously', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const store: LogStore = { append: () => Promise.reject(new Error('async fail')), query: () => ({ entries: [], cursor: '' }) }
  const log = createLogger(store, { console: false, now: () => 1 })
  expect(() => log.info('x')).not.toThrow()
  log.info('y')
  await new Promise((r) => setTimeout(r, 0)) // flush microtasks
  expect(warn).toHaveBeenCalledTimes(1) // warns once, not per entry
})

test('log.http increments seq and produces ordered ids alongside other entries', () => {
  const { store, entries } = capturing()
  let t = 2000
  const log = createLogger(store, { console: false, now: () => t++ })
  log.info('before')
  log.http({ method: 'GET', url: 'https://api.test/x', status: 200, durationMs: 1, request: { headers: {} }, response: { headers: {} } })
  expect(entries).toHaveLength(2)
  expect(entries[0].id < entries[1].id).toBe(true)
  expect(typeof entries[1].id).toBe('string')
  expect(entries[1].ts).toBe(2001)
})

test('log.http records a derived-level entry with the http payload and a console line', () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  const { store, entries } = capturing()
  const log = createLogger(store, { now: () => 1000 })
  log.http({
    method: 'POST', url: 'https://api.test/users', status: 201, durationMs: 12,
    request: { headers: { 'content-type': 'application/json' }, body: { name: 'a' } },
    response: { headers: {}, body: { id: 1 } },
  })
  expect(entries[0]).toMatchObject({
    level: 'info',
    message: 'POST https://api.test/users → 201 (12ms)',
    http: { method: 'POST', status: 201 },
  })
  expect(info).toHaveBeenCalledWith('POST https://api.test/users → 201 (12ms)')
})

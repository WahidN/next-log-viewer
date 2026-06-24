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

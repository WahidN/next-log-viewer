import { expect, test } from 'vitest'
import type { LogEntry } from './types'
import { applyQuery } from './query'

const E = (id: string, level: LogEntry['level'], message: string, data?: unknown): LogEntry =>
  ({ id, ts: Number(id), level, message, data })

const sample: LogEntry[] = [
  E('1', 'debug', 'starting'),
  E('2', 'info', 'user fetched', { userId: 7 }),
  E('3', 'warn', 'slow query'),
  E('4', 'error', 'db failed'),
]

test('since returns only newer entries and advances cursor', () => {
  const r = applyQuery(sample, { since: '2' })
  expect(r.entries.map((e) => e.id)).toEqual(['3', '4'])
  expect(r.cursor).toBe('4')
})

test('empty result keeps the since cursor', () => {
  const r = applyQuery(sample, { since: '4' })
  expect(r.entries).toEqual([])
  expect(r.cursor).toBe('4')
})

test('level filter is a minimum threshold', () => {
  const r = applyQuery(sample, { level: 'warn' })
  expect(r.entries.map((e) => e.level)).toEqual(['warn', 'error'])
})

test('search matches message and serialized data, case-insensitive', () => {
  expect(applyQuery(sample, { search: 'USERID' }).entries.map((e) => e.id)).toEqual(['2'])
  expect(applyQuery(sample, { search: 'slow' }).entries.map((e) => e.id)).toEqual(['3'])
})

test('limit caps the page size', () => {
  const r = applyQuery(sample, { limit: 2 })
  expect(r.entries.map((e) => e.id)).toEqual(['1', '2'])
  expect(r.cursor).toBe('2')
})

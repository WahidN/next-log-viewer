import { expect, test } from 'vitest'
import type { LogEntry } from '../core/types'
import { memoryStore } from './memory-store'

const E = (id: string): LogEntry => ({ id, ts: Number(id), level: 'info', message: `m${id}` })

test('append then query returns entries in order', () => {
  const s = memoryStore()
  s.append(E('1'))
  s.append(E('2'))
  expect((s.query({}) as { entries: LogEntry[] }).entries.map((e) => e.id)).toEqual(['1', '2'])
})

test('ring buffer drops oldest beyond max', () => {
  const s = memoryStore({ max: 2 })
  s.append(E('1'))
  s.append(E('2'))
  s.append(E('3'))
  expect((s.query({}) as { entries: LogEntry[] }).entries.map((e) => e.id)).toEqual(['2', '3'])
})

test('query forwards opts to applyQuery (since)', () => {
  const s = memoryStore()
  s.append(E('1'))
  s.append(E('2'))
  expect((s.query({ since: '1' }) as { entries: LogEntry[] }).entries.map((e) => e.id)).toEqual(['2'])
})

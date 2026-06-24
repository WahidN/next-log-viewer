import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { LogEntry } from '../core/types'
import { fileStore } from './file-store'

const E = (id: string): LogEntry => ({ id, ts: Number(id), level: 'info', message: `m${id}` })
let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'nlv-')) })

test('append writes JSONL and query reads it back', () => {
  const path = join(dir, 'app.jsonl')
  const s = fileStore({ path })
  s.append(E('1'))
  s.append(E('2'))
  expect(readFileSync(path, 'utf8').trim().split('\n')).toHaveLength(2)
  expect((s.query({ since: '1' }) as { entries: LogEntry[] }).entries.map((e) => e.id)).toEqual(['2'])
})

test('rotates to .1 when exceeding maxBytes', () => {
  const path = join(dir, 'app.jsonl')
  const s = fileStore({ path, maxBytes: 80 }) // one entry is well under, two exceed
  s.append(E('1'))
  s.append(E('2'))
  s.append(E('3'))
  expect(existsSync(`${path}.1`)).toBe(true)
})

test('query on a missing file returns empty', () => {
  const s = fileStore({ path: join(dir, 'nope.jsonl') })
  const r = s.query({ since: 'x' }) as { entries: LogEntry[]; cursor: string }
  expect(r.entries).toEqual([])
  expect(r.cursor).toBe('x')
})

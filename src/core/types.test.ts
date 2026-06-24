import { expect, test } from 'vitest'
import type { LogEntry } from './types'

test('LogEntry shape compiles and is usable', () => {
  const entry: LogEntry = { id: '000000000000001-000000', ts: 1, level: 'info', message: 'hi' }
  expect(entry.level).toBe('info')
})

import { expect, test } from 'vitest'
import { buildEntry, makeId, normalizeError } from './log-entry'

test('makeId zero-pads so string order equals chronological order', () => {
  const a = makeId(1000, 1)
  const b = makeId(1000, 2)
  const c = makeId(2000, 0)
  expect(a < b).toBe(true)
  expect(b < c).toBe(true)
  expect(a.length).toBe(makeId(999999999999999, 999999).length)
})

test('normalizeError extracts name/message/stack from an Error', () => {
  const e = new TypeError('boom')
  expect(normalizeError(e)).toMatchObject({ name: 'TypeError', message: 'boom' })
  expect(normalizeError('not an error')).toBeUndefined()
})

test('buildEntry routes Error to error field and data to data field', () => {
  const withData = buildEntry({ level: 'info', message: 'm', data: { a: 1 }, ts: 5, seq: 0 })
  expect(withData).toMatchObject({ level: 'info', message: 'm', ts: 5, data: { a: 1 } })
  expect(withData.error).toBeUndefined()

  const withErr = buildEntry({ level: 'error', message: 'failed', data: new Error('x'), ts: 6, seq: 1 })
  expect(withErr.error).toMatchObject({ name: 'Error', message: 'x' })
  expect(withErr.data).toBeUndefined()
})

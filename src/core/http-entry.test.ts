import { expect, test } from 'vitest'
import type { HttpCapture } from './types'
import { deriveHttpLevel, httpMessage, parseBody, redactHeaderMap, truncateBody } from './http-entry'

const base: HttpCapture = {
  method: 'GET', url: 'https://api.test/x', durationMs: 5,
  request: { headers: {} },
}

test('deriveHttpLevel maps outcome to level', () => {
  expect(deriveHttpLevel({ status: 200 })).toBe('info')
  expect(deriveHttpLevel({ status: 301 })).toBe('info')
  expect(deriveHttpLevel({ status: 404 })).toBe('warn')
  expect(deriveHttpLevel({ status: 500 })).toBe('error')
  expect(deriveHttpLevel({ error: { name: 'TypeError', message: 'x' } })).toBe('error')
})

test('httpMessage summarizes the call', () => {
  expect(httpMessage({ ...base, method: 'POST', status: 201, durationMs: 142 }))
    .toBe('POST https://api.test/x → 201 (142ms)')
  expect(httpMessage({ ...base, error: { name: 'TypeError', message: 'fail' } }))
    .toBe('GET https://api.test/x → ERR (5ms)')
})

test('redactHeaderMap replaces sensitive headers case-insensitively', () => {
  const out = redactHeaderMap(
    { Authorization: 'Bearer t', 'content-type': 'application/json' },
    ['authorization'],
  )
  expect(out).toEqual({ Authorization: '[redacted]', 'content-type': 'application/json' })
})

test('parseBody handles none/stream/binary/text/json (no truncation)', () => {
  expect(parseBody({ kind: 'none' }, undefined)).toEqual({})
  expect(parseBody({ kind: 'stream' }, 'text/event-stream')).toEqual({ body: '[stream omitted]' })
  expect(parseBody({ kind: 'binary', bytes: 42 }, 'image/png')).toEqual({ body: '[binary, 42 bytes]' })
  expect(parseBody({ kind: 'text', text: 'hello' }, 'text/plain')).toEqual({ body: 'hello' })
  expect(parseBody({ kind: 'text', text: '{"a":1}' }, 'application/json')).toEqual({ body: { a: 1 } })
})

test('parseBody falls back to the raw string when application/json is invalid', () => {
  expect(parseBody({ kind: 'text', text: 'not-json' }, 'application/json'))
    .toEqual({ body: 'not-json' })
})

test('truncateBody leaves within-budget values unchanged, including objects', () => {
  expect(truncateBody('hello', 100)).toEqual({ body: 'hello' })
  expect(truncateBody({ a: 1 }, 100)).toEqual({ body: { a: 1 } })
  expect(truncateBody(undefined, 100)).toEqual({ body: undefined })
})

test('truncateBody truncates over-budget strings on a UTF-8 character boundary', () => {
  const big = truncateBody('x'.repeat(200), 10)
  expect(big.truncated).toBe(true)
  expect(String(big.body).length).toBeLessThan(200)
  expect(String(big.body)).toMatch(/\[truncated\]$/)

  const multi = truncateBody('😀'.repeat(10), 5)
  expect(multi.truncated).toBe(true)
  expect(String(multi.body)).not.toContain('�')
  expect(String(multi.body).startsWith('😀')).toBe(true)
})

test('truncateBody serializes then truncates an over-budget object', () => {
  const r = truncateBody({ blob: 'y'.repeat(200) }, 20)
  expect(r.truncated).toBe(true)
  expect(typeof r.body).toBe('string')
  expect(String(r.body)).toMatch(/\[truncated\]$/)
})

test('deriveHttpLevel defaults to info when neither status nor error is present', () => {
  expect(deriveHttpLevel({})).toBe('info')
})

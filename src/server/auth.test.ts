import { expect, test } from 'vitest'
import { COOKIE_NAME, isAuthed, parseCookie, safeEqual, sessionCookie, signToken } from './auth'

test('safeEqual compares without leaking via length mismatch', () => {
  expect(safeEqual('abc', 'abc')).toBe(true)
  expect(safeEqual('abc', 'abd')).toBe(false)
  expect(safeEqual('abc', 'abcd')).toBe(false)
})

test('parseCookie extracts a named cookie', () => {
  expect(parseCookie('x=1; nlv_session=tok; y=2', COOKIE_NAME)).toBe('tok')
  expect(parseCookie(null, COOKIE_NAME)).toBeUndefined()
})

test('isAuthed accepts a request carrying a valid signed cookie', () => {
  const secret = 'super-secret'
  const token = signToken(secret)
  const good = new Request('http://x/entries', { headers: { cookie: `${COOKIE_NAME}=${token}` } })
  const bad = new Request('http://x/entries', { headers: { cookie: `${COOKIE_NAME}=nope` } })
  expect(isAuthed(good, secret)).toBe(true)
  expect(isAuthed(bad, secret)).toBe(false)
  expect(sessionCookie(secret)).toContain('HttpOnly')
})

import { afterEach, beforeEach, expect, test } from 'vitest'
import { memoryStore } from '../stores/memory-store'
import { COOKIE_NAME, signToken } from './auth'
import { createHandlers } from './handlers'

const BASE = 'http://localhost/api/_logs'
const SECRET = 'shh'
let envBackup: string | undefined
beforeEach(() => { envBackup = process.env.NODE_ENV })
afterEach(() => { process.env.NODE_ENV = envBackup })

function seeded() {
  const store = memoryStore()
  store.append({ id: '1', ts: 1, level: 'info', message: 'hello' })
  return store
}

test('GET /entries is 401 without a valid cookie', async () => {
  const { GET } = createHandlers({ store: seeded(), secret: SECRET })
  const res = await GET(new Request(`${BASE}/entries`))
  expect(res.status).toBe(401)
})

test('POST /auth sets a cookie for the right secret, 401 for wrong', async () => {
  const { POST } = createHandlers({ store: seeded(), secret: SECRET })
  const ok = await POST(new Request(`${BASE}/auth`, { method: 'POST', body: JSON.stringify({ secret: SECRET }) }))
  expect(ok.status).toBe(200)
  expect(ok.headers.get('set-cookie')).toContain(COOKIE_NAME)

  const bad = await POST(new Request(`${BASE}/auth`, { method: 'POST', body: JSON.stringify({ secret: 'wrong' }) }))
  expect(bad.status).toBe(401)
})

test('GET /entries returns data when authed, forwarding query params', async () => {
  const { GET } = createHandlers({ store: seeded(), secret: SECRET })
  const req = new Request(`${BASE}/entries?level=info`, { headers: { cookie: `${COOKIE_NAME}=${signToken(SECRET)}` } })
  const res = await GET(req)
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body.entries.map((e: { id: string }) => e.id)).toEqual(['1'])
  expect(body.cursor).toBe('1')
})

test('GET /session reports authed:false without a cookie (no 401)', async () => {
  const { GET } = createHandlers({ store: seeded(), secret: SECRET })
  const res = await GET(new Request(`${BASE}/session`))
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ authed: false })
})

test('GET /session reports authed:true with a valid cookie', async () => {
  const { GET } = createHandlers({ store: seeded(), secret: SECRET })
  const req = new Request(`${BASE}/session`, { headers: { cookie: `${COOKIE_NAME}=${signToken(SECRET)}` } })
  const res = await GET(req)
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ authed: true })
})

test('GET /session is 404 when disabled in production', async () => {
  process.env.NODE_ENV = 'production'
  const { GET } = createHandlers({ store: seeded(), secret: SECRET, enabledInProduction: false })
  const res = await GET(new Request(`${BASE}/session`))
  expect(res.status).toBe(404)
})

test('disabled in production returns 404', async () => {
  process.env.NODE_ENV = 'production'
  const { GET } = createHandlers({ store: seeded(), secret: SECRET, enabledInProduction: false })
  const res = await GET(new Request(`${BASE}/entries`, { headers: { cookie: `${COOKIE_NAME}=${signToken(SECRET)}` } }))
  expect(res.status).toBe(404)
})

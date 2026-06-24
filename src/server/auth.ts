import { createHmac, timingSafeEqual } from 'node:crypto'

export const COOKIE_NAME = 'nlv_session'

export function signToken(secret: string): string {
  return createHmac('sha256', secret).update('next-log-viewer').digest('hex')
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function parseCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return undefined
}

export function sessionCookie(secret: string): string {
  const token = signToken(secret)
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`
}

export function isAuthed(req: Request, secret: string): boolean {
  const token = parseCookie(req.headers.get('cookie'), COOKIE_NAME)
  if (!token) return false
  return safeEqual(token, signToken(secret))
}

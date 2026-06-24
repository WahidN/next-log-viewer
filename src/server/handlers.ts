import type { Level, LogStore, QueryOpts } from '../core/types'
import { LEVELS } from '../core/levels'
import { isAuthed, safeEqual, sessionCookie } from './auth'

export interface HandlersOptions {
  store: LogStore
  secret?: string
  enabledInProduction?: boolean
}

export interface Handlers {
  GET: (req: Request) => Promise<Response>
  POST: (req: Request) => Promise<Response>
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

function lastSegment(url: URL): string {
  const parts = url.pathname.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

function parseLevel(v: string | null): Level | undefined {
  return v && (LEVELS as string[]).includes(v) ? (v as Level) : undefined
}

function parseLimit(v: string | null): number | undefined {
  if (!v) return undefined
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5000) : undefined
}

export function createHandlers(opts: HandlersOptions): Handlers {
  const { store, secret } = opts
  const enabledInProduction = opts.enabledInProduction ?? false

  const disabled = () => process.env.NODE_ENV === 'production' && !enabledInProduction

  const GET = async (req: Request): Promise<Response> => {
    if (disabled()) return json(404, { error: 'not found' })
    const url = new URL(req.url)
    const segment = lastSegment(url)

    // Cheap auth probe used by the viewer on mount: always 200 so an unauthed
    // viewer never produces a 401 in the console — it just learns to show the
    // unlock form instead of polling.
    if (segment === 'session') {
      return json(200, { authed: secret ? isAuthed(req, secret) : false })
    }

    if (segment !== 'entries') return json(404, { error: 'not found' })
    if (!secret || !isAuthed(req, secret)) return json(401, { error: 'unauthorized' })
    const q = url.searchParams
    const query: QueryOpts = {
      since: q.get('since') ?? undefined,
      level: parseLevel(q.get('level')),
      search: q.get('search') ?? undefined,
      limit: parseLimit(q.get('limit')),
    }
    const result = await store.query(query)
    return json(200, result)
  }

  const POST = async (req: Request): Promise<Response> => {
    if (disabled()) return json(404, { error: 'not found' })
    const url = new URL(req.url)
    if (lastSegment(url) !== 'auth') return json(404, { error: 'not found' })
    if (!secret) return json(403, { error: 'viewer secret not configured' })
    let body: { secret?: string } = {}
    try {
      body = (await req.json()) as { secret?: string }
    } catch {
      // ignore malformed body
    }
    if (!body.secret || !safeEqual(body.secret, secret)) {
      return json(401, { error: 'invalid secret' })
    }
    return json(200, { ok: true }, { 'set-cookie': sessionCookie(secret) })
  }

  return { GET, POST }
}

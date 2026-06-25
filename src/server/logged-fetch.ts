import type { Logger } from '../core/logger'
import type { HttpCapture } from '../core/types'
import { type RawBody, parseBody, redactHeaderMap, truncateBody } from '../core/http-entry'

export interface LoggedFetchOptions {
  /** Header names (case-insensitive) whose values become "[redacted]". */
  redactHeaders?: string[]
  /** Bodies longer than this many bytes are truncated. */
  maxBodyBytes?: number
  /** Mask fields in a parsed body before storage. */
  redactBody?: (body: unknown, ctx: { direction: 'request' | 'response'; contentType?: string }) => unknown
}

const DEFAULT_REDACT = ['authorization', 'cookie', 'set-cookie', 'x-api-key']
const DEFAULT_MAX_BODY = 32_768

const TEXTUAL = ['application/json', 'text/', 'application/xml', '+json', 'application/x-www-form-urlencoded']

function isTextual(ct: string): boolean {
  const lc = ct.toLowerCase()
  return TEXTUAL.some((t) => lc.includes(t))
}

function headerMap(h: Headers): Record<string, string> {
  return Object.fromEntries(h.entries())
}

function normalizeError(err: unknown): { name: string; message: string } {
  if (err instanceof Error) return { name: err.name, message: err.message }
  return { name: 'Error', message: String(err) }
}

async function readBody(source: Request | Response): Promise<RawBody> {
  if (!source.body) return { kind: 'none' }
  const ct = source.headers.get('content-type') ?? ''
  // Only SSE-by-content-type is omitted; other streaming/chunked responses are
  // buffered on the clone then capped by truncateBody (acceptable for v1).
  if (ct.toLowerCase().includes('text/event-stream')) return { kind: 'stream' }
  if (isTextual(ct)) {
    const text = await source.text()
    return text === '' ? { kind: 'none' } : { kind: 'text', text }
  }
  const buf = await source.arrayBuffer()
  return buf.byteLength === 0 ? { kind: 'none' } : { kind: 'binary', bytes: buf.byteLength }
}

export function createLoggedFetch(log: Logger, options: LoggedFetchOptions = {}): typeof fetch {
  const redact = options.redactHeaders ?? DEFAULT_REDACT
  const maxBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY

  async function bodyFor(source: Request | Response, direction: 'request' | 'response') {
    const ct = source.headers.get('content-type') ?? undefined
    const raw = await readBody(source)
    // parse → redact → truncate: redactBody must see the structured body before
    // truncation could turn a JSON object into a partial string.
    let value = parseBody(raw, ct).body
    if (value !== undefined && options.redactBody) {
      value = options.redactBody(value, { direction, contentType: ct })
    }
    return truncateBody(value, maxBytes)
  }

  async function record(req: Request, res: Response | undefined, durationMs: number, error?: { name: string; message: string }) {
    try {
      const reqPart = await bodyFor(req, 'request')
      const capture: HttpCapture = {
        method: req.method,
        url: req.url,
        durationMs,
        request: {
          headers: redactHeaderMap(headerMap(req.headers), redact),
          ...(reqPart.body !== undefined ? { body: reqPart.body } : {}),
        },
      }
      let truncated = reqPart.truncated ?? false

      if (error) {
        capture.error = error
      } else if (res) {
        capture.status = res.status
        capture.statusText = res.statusText
        const resPart = await bodyFor(res, 'response')
        capture.response = {
          headers: redactHeaderMap(headerMap(res.headers), redact),
          ...(resPart.body !== undefined ? { body: resPart.body } : {}),
        }
        truncated = truncated || (resPart.truncated ?? false)
      }
      if (truncated) capture.truncated = true
      log.http(capture)
    } catch {
      // capture must never break the caller
    }
  }

  return async function loggedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const req = new Request(input instanceof URL ? input.href : input, init)
    const reqClone = req.clone()
    const start = Date.now()
    let res: Response
    try {
      res = await fetch(req)
    } catch (err) {
      void record(reqClone, undefined, Date.now() - start, normalizeError(err))
      throw err
    }
    const resClone = res.clone()
    void record(reqClone, resClone, Date.now() - start, undefined)
    return res
  }
}

import type { HttpCapture, Level } from './types'

export type RawBody =
  | { kind: 'none' }
  | { kind: 'stream' }
  | { kind: 'binary'; bytes: number }
  | { kind: 'text'; text: string }

export function deriveHttpLevel(capture: Pick<HttpCapture, 'status' | 'error'>): Level {
  if (capture.error || (capture.status !== undefined && capture.status >= 500)) return 'error'
  if (capture.status !== undefined && capture.status >= 400) return 'warn'
  return 'info'
}

export function httpMessage(capture: HttpCapture): string {
  const outcome = capture.error ? 'ERR' : String(capture.status ?? '???')
  return `${capture.method} ${capture.url} → ${outcome} (${capture.durationMs}ms)`
}

export function redactHeaderMap(
  headers: Record<string, string>,
  redact: string[],
): Record<string, string> {
  const deny = new Set(redact.map((h) => h.toLowerCase()))
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    out[k] = deny.has(k.toLowerCase()) ? '[redacted]' : v
  }
  return out
}

export function parseBody(
  raw: RawBody,
  contentType: string | undefined,
): { body?: unknown } {
  if (raw.kind === 'none') return {}
  if (raw.kind === 'stream') return { body: '[stream omitted]' }
  if (raw.kind === 'binary') return { body: `[binary, ${raw.bytes} bytes]` }

  if (contentType && contentType.includes('application/json')) {
    try {
      return { body: JSON.parse(raw.text) }
    } catch {
      // not valid JSON — fall through to the raw string
    }
  }
  return { body: raw.text }
}

/**
 * Truncate a parsed body to a byte budget, AFTER any redactBody hook has run,
 * so field masking always sees the structured value. Strings (and the
 * JSON-serialized form of objects) longer than maxBytes are cut on a UTF-8
 * character boundary and marked truncated; values within budget are returned
 * unchanged (objects stay objects so the viewer can pretty-print them).
 */
export function truncateBody(
  body: unknown,
  maxBytes: number,
): { body?: unknown; truncated?: boolean } {
  if (body === undefined) return { body }
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  if (typeof text !== 'string') return { body } // JSON.stringify returned undefined
  const encoded = new TextEncoder().encode(text)
  if (encoded.length <= maxBytes) return { body }
  // Don't split a multi-byte UTF-8 sequence: back up off any continuation byte.
  let end = maxBytes
  while (end > 0 && (encoded[end] & 0xc0) === 0x80) end--
  const cut = new TextDecoder().decode(encoded.slice(0, end))
  return { body: `${cut}…[truncated]`, truncated: true }
}

import type { LogEntry, QueryOpts, QueryResult } from './types'
import { levelAtLeast } from './levels'

const DEFAULT_LIMIT = 500

function serialize(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

export function applyQuery(entries: LogEntry[], opts: QueryOpts = {}): QueryResult {
  const { since, level, search, limit = DEFAULT_LIMIT } = opts
  const needle = search?.toLowerCase()
  const filtered = entries.filter((e) => {
    if (since && e.id <= since) return false
    if (level && !levelAtLeast(e.level, level)) return false
    if (needle) {
      const hay = `${e.message} ${serialize(e.data)} ${serialize(e.error)}`.toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
  const page = filtered.slice(0, limit)
  const cursor = page.length ? page[page.length - 1].id : since ?? ''
  return { entries: page, cursor }
}

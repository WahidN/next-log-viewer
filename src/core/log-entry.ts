import type { Level, LogEntry } from './types'

export function normalizeError(err: unknown): LogEntry['error'] | undefined {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  return undefined
}

export function makeId(ts: number, seq: number): string {
  return `${String(ts).padStart(15, '0')}-${String(seq).padStart(6, '0')}`
}

export interface BuildEntryInput {
  level: Level
  message: string
  data?: unknown
  ts: number
  seq: number
}

export function buildEntry({ level, message, data, ts, seq }: BuildEntryInput): LogEntry {
  const entry: LogEntry = { id: makeId(ts, seq), ts, level, message }
  if (data instanceof Error) {
    entry.error = normalizeError(data)
  } else if (data !== undefined) {
    entry.data = data
  }
  return entry
}

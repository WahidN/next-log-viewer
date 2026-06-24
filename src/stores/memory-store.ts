import type { LogEntry, LogStore, QueryOpts } from '../core/types'
import { applyQuery } from '../core/query'

export interface MemoryStoreOptions {
  max?: number
}

export function memoryStore(options: MemoryStoreOptions = {}): LogStore {
  const max = options.max ?? 5000
  const buffer: LogEntry[] = []
  return {
    append(entry: LogEntry) {
      buffer.push(entry)
      if (buffer.length > max) buffer.splice(0, buffer.length - max)
    },
    query(opts: QueryOpts) {
      return applyQuery(buffer, opts)
    },
  }
}

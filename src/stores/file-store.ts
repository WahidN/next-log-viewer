import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import type { LogEntry, LogStore, QueryOpts } from '../core/types'
import { applyQuery } from '../core/query'

export interface FileStoreOptions {
  path: string
  maxBytes?: number
}

export function fileStore(options: FileStoreOptions): LogStore {
  const { path } = options
  const maxBytes = options.maxBytes ?? 50_000_000
  mkdirSync(dirname(path), { recursive: true })
  let size = existsSync(path) ? statSync(path).size : 0

  return {
    append(entry: LogEntry) {
      const line = `${JSON.stringify(entry)}\n`
      const bytes = Buffer.byteLength(line)
      if (size > 0 && size + bytes > maxBytes) {
        renameSync(path, `${path}.1`)
        size = 0
      }
      appendFileSync(path, line)
      size += bytes
    },
    query(opts: QueryOpts) {
      if (!existsSync(path)) return { entries: [], cursor: opts.since ?? '' }
      const entries: LogEntry[] = []
      for (const line of readFileSync(path, 'utf8').split('\n')) {
        if (!line) continue
        try {
          entries.push(JSON.parse(line) as LogEntry)
        } catch {
          // skip corrupt line
        }
      }
      return applyQuery(entries, opts)
    },
  }
}

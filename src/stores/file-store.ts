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
  // Defer creating the directory until the first append, so a store that is
  // never written to (e.g. a disabled-in-production logger) leaves nothing on
  // disk. `size` stays undefined until then.
  let size: number | undefined

  function ensureReady(): number {
    if (size === undefined) {
      mkdirSync(dirname(path), { recursive: true })
      size = existsSync(path) ? statSync(path).size : 0
    }
    return size
  }

  return {
    append(entry: LogEntry) {
      let current = ensureReady()
      const line = `${JSON.stringify(entry)}\n`
      const bytes = Buffer.byteLength(line)
      if (current > 0 && current + bytes > maxBytes) {
        renameSync(path, `${path}.1`)
        current = 0
      }
      appendFileSync(path, line)
      size = current + bytes
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

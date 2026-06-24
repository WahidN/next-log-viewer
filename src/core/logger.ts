import type { Level, LogStore } from './types'
import { buildEntry } from './log-entry'

export interface Logger {
  debug(message: string, data?: unknown): void
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

export interface CreateLoggerOptions {
  console?: boolean
  now?: () => number
}

export function createLogger(store: LogStore, options: CreateLoggerOptions = {}): Logger {
  const passthrough = options.console ?? true
  const now = options.now ?? (() => Date.now())
  let seq = 0
  let warned = false

  function warnOnce() {
    if (!warned) {
      warned = true
      console.warn('[next-log-viewer] log store append failed; logging to console only')
    }
  }

  function record(level: Level, message: string, data?: unknown) {
    const entry = buildEntry({ level, message, data, ts: now(), seq: seq++ })
    try {
      const result = store.append(entry)
      if (result instanceof Promise) result.catch(() => warnOnce())
    } catch {
      warnOnce()
    }
    if (passthrough) {
      const fn = (console as unknown as Record<string, unknown>)[level]
      const out = typeof fn === 'function' ? (fn as (...a: unknown[]) => void) : console.log
      if (data === undefined) out(message)
      else out(message, data)
    }
  }

  return {
    debug: (m, d) => record('debug', m, d),
    info: (m, d) => record('info', m, d),
    warn: (m, d) => record('warn', m, d),
    error: (m, d) => record('error', m, d),
  }
}

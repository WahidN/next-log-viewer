import type { HttpCapture, Level, LogEntry, LogStore } from './types'
import { buildEntry, makeId } from './log-entry'
import { deriveHttpLevel, httpMessage } from './http-entry'

export interface Logger {
  debug(message: string, data?: unknown): void
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
  http(capture: HttpCapture): void
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

  function commit(entry: LogEntry, consoleArgs: unknown[]) {
    try {
      const result = store.append(entry)
      if (result instanceof Promise) result.catch(() => warnOnce())
    } catch {
      warnOnce()
    }
    if (passthrough) {
      const fn = (console as unknown as Record<string, unknown>)[entry.level]
      const out = typeof fn === 'function' ? (fn as (...a: unknown[]) => void) : console.log
      out(...consoleArgs)
    }
  }

  function record(level: Level, message: string, data?: unknown) {
    const entry = buildEntry({ level, message, data, ts: now(), seq: seq++ })
    commit(entry, data === undefined ? [message] : [message, data])
  }

  function http(capture: HttpCapture) {
    const ts = now()
    const entry: LogEntry = {
      id: makeId(ts, seq++),
      ts,
      level: deriveHttpLevel(capture),
      message: httpMessage(capture),
      http: capture,
    }
    commit(entry, [entry.message])
  }

  return {
    debug: (m, d) => record('debug', m, d),
    info: (m, d) => record('info', m, d),
    warn: (m, d) => record('warn', m, d),
    error: (m, d) => record('error', m, d),
    http,
  }
}

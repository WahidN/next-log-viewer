export type Level = 'debug' | 'info' | 'warn' | 'error'

export interface HttpCapture {
  method: string
  url: string
  status?: number
  statusText?: string
  durationMs: number
  request: { headers: Record<string, string>; body?: unknown }
  response?: { headers: Record<string, string>; body?: unknown }
  error?: { name: string; message: string }
  truncated?: boolean
}

export interface LogEntry {
  id: string
  ts: number
  level: Level
  message: string
  data?: unknown
  error?: { name: string; message: string; stack?: string }
  http?: HttpCapture
}

export interface QueryOpts {
  since?: string
  level?: Level
  search?: string
  limit?: number
}

export interface QueryResult {
  entries: LogEntry[]
  cursor: string
}

export interface LogStore {
  append(entry: LogEntry): void | Promise<void>
  query(opts: QueryOpts): QueryResult | Promise<QueryResult>
}

/**
 * Client-safe viewer configuration. Contains no secret and is safe to pass from
 * a server component straight into the <LogViewer> client component.
 */
export interface ViewerConfig {
  /** Page route the viewer is mounted at, e.g. '/logs'. Single source of truth for links. */
  path: string
  /** API route base the viewer polls, e.g. '/api/logs'. Must match the route file location. */
  basePath: string
  /** Poll interval in milliseconds. */
  intervalMs: number
}

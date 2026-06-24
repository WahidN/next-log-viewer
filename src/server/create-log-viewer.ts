import type { LogStore, ViewerConfig } from '../core/types'
import { createLogger, type Logger } from '../core/logger'
import { createHandlers, type Handlers } from './handlers'

export const DEFAULT_PATH = '/logs'
export const DEFAULT_BASE_PATH = '/api/logs'
export const DEFAULT_INTERVAL_MS = 5000

export interface CreateLogViewerOptions {
  store: LogStore
  secret?: string
  enabledInProduction?: boolean
  /** Page route the viewer is mounted at. Default '/logs' — change it freely if taken. */
  path?: string
  /** API route base the viewer polls. Default '/api/logs' — must match your route file. */
  basePath?: string
  /** Poll interval in milliseconds. Default 5000. */
  intervalMs?: number
}

export interface LogViewerInstance {
  log: Logger
  handlers: Handlers
  /** Client-safe config (no secret) to pass into <LogViewer config={config} />. */
  config: ViewerConfig
}

export function createLogViewer(opts: CreateLogViewerOptions): LogViewerInstance {
  const log = createLogger(opts.store)
  const handlers = createHandlers({
    store: opts.store,
    secret: opts.secret,
    enabledInProduction: opts.enabledInProduction,
  })
  const config: ViewerConfig = {
    path: opts.path ?? DEFAULT_PATH,
    basePath: opts.basePath ?? DEFAULT_BASE_PATH,
    intervalMs: opts.intervalMs ?? DEFAULT_INTERVAL_MS,
  }
  return { log, handlers, config }
}

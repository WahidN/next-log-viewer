import { createLogViewer, createLoggedFetch, memoryStore } from '@wahidn/next-log-viewer/server'

// Single source of truth: the logger and the viewer handlers must share ONE store.
// We cache the instance on globalThis so Next.js dev hot-reloads don't recreate the
// store (and lose your logs) on every code change.
const globalForLogViewer = globalThis as unknown as {
  __nlv?: ReturnType<typeof createLogViewer>
}

export const { log, handlers, config } =
  globalForLogViewer.__nlv ??
  (globalForLogViewer.__nlv = createLogViewer({
    // Dev: in-memory ring buffer. For a long-running prod server you'd swap in
    // fileStore({ path: '.logs/app.jsonl' }).
    store: memoryStore({ max: 5000 }),
    // Type this secret into the viewer's unlock form. Override via LOG_VIEWER_SECRET.
    secret: process.env.LOG_VIEWER_SECRET ?? 'dev-secret',
    enabledInProduction: true,
    // Single source of truth for the viewer. Change `path` if /logs is taken — just
    // move app/logs/page.tsx to match. `basePath` must match the API route folder.
    path: '/logs',
    basePath: '/api/logs',
    intervalMs: 5000,
  }))

// A drop-in `fetch` replacement that records every server-side request/response
// pair to the same store the viewer reads — your "network tab" for outbound
// server calls. Sensitive headers (authorization/cookie/…) are redacted by
// default; the redactBody hook below masks a `password` field before storage.
export const loggedFetch = createLoggedFetch(log, {
  redactBody: (body) =>
    body && typeof body === 'object' && 'password' in body
      ? { ...(body as Record<string, unknown>), password: '[redacted]' }
      : body,
})

# next-log-viewer

A drop-in log viewer for Next.js server-side logs. Log through an explicit API; view them live in a protected in-app route. Works in dev and production.

## Install

```bash
npm install @wahidn/next-log-viewer
```

## Setup (3 files)

```ts
// lib/log-viewer.ts — logger + handlers share ONE store, and one config object
import { createLogViewer, memoryStore, fileStore } from '@wahidn/next-log-viewer/server'

export const { log, handlers, config } = createLogViewer({
  store: process.env.NODE_ENV === 'production'
    ? fileStore({ path: '.logs/app.jsonl', maxBytes: 50_000_000 })
    : memoryStore({ max: 5000 }),
  secret: process.env.LOG_VIEWER_SECRET,
  enabledInProduction: true,

  // All optional — these are the defaults:
  path: '/logs',          // page route (single source of truth for links)
  basePath: '/api/logs',  // API route base — must match the route file below
  intervalMs: 5000,       // how often the viewer polls for new logs
})
```

```ts
// app/api/logs/[[...path]]/route.ts
import { handlers } from '@/lib/log-viewer'
export const dynamic = 'force-dynamic'
export const { GET, POST } = handlers
```

```tsx
// app/logs/page.tsx
import { LogViewer } from '@wahidn/next-log-viewer/ui'
import { config } from '@/lib/log-viewer'
export default () => <LogViewer config={config} />
```

### Choosing the route

`config` is the single source of truth — the page, the API route, and any nav link all read
from it, so you change a value once and nothing drifts out of sync. `config` contains no
secret, so it's safe to pass straight into the client `<LogViewer>`.

Next.js still routes by file location, so to actually move the viewer you change `path` **and**
move `app/logs/page.tsx` to match (likewise `basePath` ↔ the API route folder). This matters
because `/logs` is a common route you may want for something else — pick whatever's free.

> **Do not** use a folder name starting with `_` (e.g. `_logs`): Next.js treats
> underscore-prefixed folders as private and excludes them from routing.

## Usage

```ts
import { log } from '@/lib/log-viewer'

export async function GET() {
  log.info('user fetched', { userId: 7 })
  log.error('db failed', new Error('timeout'))
  // ...
}
```

Set `LOG_VIEWER_SECRET` in your environment, then visit `/logs` and enter the secret.
Logs still print to your terminal as usual.

The viewer probes its session once on load and only starts polling **after** you unlock it,
so an unauthenticated page never spams the API with `401`s — it just shows the unlock form.

### Where you can log

`log` is a plain server-side function: it appends to the store and prints to your terminal.
It has no dependency on a request, `headers()`, or `cookies()`, so you can call it anywhere
that runs on the server — **route handlers, Server Actions, and Server Components** — and
every call writes to the same store the viewer reads.

```ts
// Server Action — app/actions.ts
'use server'
import { log } from '@/lib/log-viewer'

export async function createPost(formData: FormData) {
  log.info('creating post', { title: formData.get('title') })
  // ...
}
```

```tsx
// Server Component — app/dashboard/page.tsx
import { log } from '@/lib/log-viewer'

export default async function Dashboard() {
  log.info('rendering dashboard')  // fires when the component renders
  return <div>…</div>
}
```

Always import `log` from your shared `lib/log-viewer` module (don't call `createLogViewer`
again) so every call lands in the one store the viewer polls.

> **Server Component caveat:** logging in a Server Component is a *render-time* side effect.
> If the segment is static or its render is cached, the log fires when Next.js renders it —
> at build time, or once then served from cache — not on every request. For per-request
> logging, log from a route handler or Server Action, or make the segment dynamic with
> `export const dynamic = 'force-dynamic'`.

### Capturing outbound fetch (a network tab for the server)

Server-side `fetch` calls never show up in the browser Network tab. Wrap `fetch` with
`createLoggedFetch` to record each request/response pair as an entry the viewer renders as a
Network-style row (method · URL · status · duration, expandable to headers + bodies).

```ts
// lib/log-viewer.ts
import { createLogViewer, createLoggedFetch, memoryStore } from '@wahidn/next-log-viewer/server'

export const { log, handlers, config } = createLogViewer({ store: memoryStore(), secret: process.env.LOG_VIEWER_SECRET })

export const loggedFetch = createLoggedFetch(log, {
  // all optional — these are the defaults
  redactHeaders: ['authorization', 'cookie', 'set-cookie', 'x-api-key'],
  maxBodyBytes: 32_768,
  // redactBody: (body, ctx) => body,  // mask fields like password
})
```

```ts
// in a Server Action or route handler — drop-in replacement for fetch
import { loggedFetch } from '@/lib/log-viewer'

const res = await loggedFetch(`${process.env.API_URL}/users`, { method: 'POST', body })
```

Sensitive headers are redacted and large bodies truncated **before** anything is stored.
The wrapper returns the real response unread, so your code keeps working unchanged; capture
happens in the background and never throws into your call. Network failures are recorded
(with the error) and re-thrown as usual.

## Notes

- Serverless (Vercel): the bundled `memoryStore`/`fileStore` are per-instance and
  non-durable. Implement the `LogStore` interface against Redis/a database for shared,
  durable storage. The interface is `{ append(entry), query(opts) }`.
- Edge runtime: `fileStore` uses `node:fs`, so it can't run on the Edge runtime
  (`export const runtime = 'edge'`), which has no filesystem. The Node.js runtime — the
  default everywhere, including Vercel's serverless functions — is fine. For Edge, back
  the `LogStore` interface with a network service like Redis instead.
- Transport is client polling (interval set by `intervalMs`, default 5s); robust across
  dev, servers, and serverless.

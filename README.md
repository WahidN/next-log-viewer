# next-log-viewer

A drop-in log viewer for Next.js server-side logs. Log through an explicit API; view them live in a protected in-app route. Works in dev and production.

## Install

```bash
npm install next-log-viewer
```

## Setup (3 files)

```ts
// lib/log-viewer.ts — logger + handlers share ONE store, and one config object
import { createLogViewer, memoryStore, fileStore } from 'next-log-viewer/server'

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
import { LogViewer } from 'next-log-viewer/ui'
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

## Notes

- Serverless (Vercel): the bundled `memoryStore`/`fileStore` are per-instance and
  non-durable. Implement the `LogStore` interface against Redis/a database for shared,
  durable storage. The interface is `{ append(entry), query(opts) }`.
- Transport is client polling (interval set by `intervalMs`, default 5s); robust across
  dev, servers, and serverless.

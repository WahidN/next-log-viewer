# next-log-viewer example

A minimal Next.js (App Router) app that consumes the local `next-log-viewer` package
and shows server-side logs in a GUI.

## Run

From the **repo root** (so the package is built and linked):

```bash
pnpm install          # links the local package into this example
pnpm build            # build the package into dist/ (the example imports its dist/)
cd example && pnpm dev   # start the example on http://localhost:3000
```

Then:

1. Open http://localhost:3000 and click **Generate server logs** a few times.
2. Open http://localhost:3000/logs and unlock with the secret **`dev-secret`**.
3. Generate more logs and watch them stream in live (~1.5s poll). Click a row to expand
   its structured data / error stack.

## What's wired up (3 files)

- `lib/log-viewer.ts` — creates the shared logger + viewer handlers (in-memory store, dev secret).
- `app/api/logs/[[...path]]/route.ts` — mounts the viewer's GET/POST handlers.
- `app/logs/page.tsx` — renders `<LogViewer basePath="/api/logs" />`.

The "apps under test" are two route handlers:

- `app/api/demo/route.ts` — emits info/debug/warn/error logs (including an Error with a stack
  trace) on each request.
- `app/api/fetch-demo/route.ts` — uses `loggedFetch` (from `createLoggedFetch`) to make outbound
  server-side calls. Each request/response pair is captured and rendered in the viewer as a
  **network row** (method · URL · status · duration, expandable to headers + bodies) — a network
  tab for the server calls the browser never shows. Sensitive headers and a `password` field are
  redacted before storage. (Requires network access to `jsonplaceholder.typicode.com`; if it's
  unreachable, the failed call is still captured as an error row.)

> Note: the example imports the package's built output (`dist/`). If you change the
> package source, rebuild it (`pnpm --filter next-log-viewer build`).

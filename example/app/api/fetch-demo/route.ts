import { log, loggedFetch } from '@/lib/log-viewer'

// Demonstrates createLoggedFetch: outbound server-side fetch calls captured as
// network rows in the viewer — the "network tab" for calls the browser never
// shows (Server Actions / route handlers calling an external or internal API).
// Force dynamic so each click re-runs the handler.
export const dynamic = 'force-dynamic'

export async function GET() {
  log.info('GET /api/fetch-demo called — making outbound calls')

  // A simple GET to an external JSON API. Appears as a network row with status,
  // timing, and the response body. The caller can still read the body normally
  // after capture (capture reads a clone, not the response you get back).
  const todoRes = await loggedFetch('https://jsonplaceholder.typicode.com/todos/1')
  const todo = await todoRes.json()

  // A POST with a JSON payload and an auth header. createLoggedFetch redacts the
  // Authorization header (a default) and masks the `password` field (via the
  // redactBody hook in lib/log-viewer.ts) BEFORE anything is stored — so neither
  // secret ever reaches the viewer or the store.
  const createRes = await loggedFetch('https://jsonplaceholder.typicode.com/posts', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer demo-token-should-be-redacted',
    },
    body: JSON.stringify({
      title: 'created from a server route',
      body: 'this request payload is captured',
      userId: 1,
      password: 'super-secret-should-be-masked',
    }),
  })
  const created = await createRes.json()

  log.info('outbound calls complete', { todoTitle: todo.title, createdId: created.id })

  return Response.json({ ok: true, todoTitle: todo.title, createdId: created.id })
}

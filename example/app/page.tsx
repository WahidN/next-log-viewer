import { DemoButton } from './demo-button'
import { config } from '@/lib/log-viewer'

export default function Home() {
  const pollSeconds = Math.round(config.intervalMs / 100) / 10
  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px', lineHeight: 1.6 }}>
      <h1 style={{ marginBottom: 8 }}>next-log-viewer example</h1>
      <p style={{ color: '#555', marginTop: 0 }}>
        Two demos below. Both stream live into the{' '}
        <a href={config.path} target="_blank" rel="noreferrer">log viewer</a> — open it, unlock with
        the secret <code>dev-secret</code>, then click the buttons and watch entries appear
        (~{pollSeconds}s poll).
      </p>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>1 · Explicit logging</h2>
        <p style={{ color: '#555', marginTop: 0 }}>
          <code>/api/demo</code> emits several <code>log.info / debug / warn / error</code> calls
          (including an error with a stack trace). Click a row in the viewer to expand its
          structured data.
        </p>
        <DemoButton endpoint="/api/demo" idleLabel="Generate server logs" />
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>2 · Outbound fetch capture (a network tab)</h2>
        <p style={{ color: '#555', marginTop: 0 }}>
          <code>/api/fetch-demo</code> uses <code>loggedFetch</code> to make outbound server-side
          calls (a GET and a POST). Each appears as a <strong>network row</strong> — method · URL ·
          status · duration — that expands to request/response headers and bodies. The{' '}
          <code>Authorization</code> header and a <code>password</code> field are redacted before
          anything is stored.
        </p>
        <DemoButton endpoint="/api/fetch-demo" idleLabel="Run outbound fetch demo" />
      </section>

      <p style={{ marginTop: 32 }}>
        <a href={config.path} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
          Open the log viewer →
        </a>
      </p>
    </main>
  )
}

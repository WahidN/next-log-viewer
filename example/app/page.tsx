import { GenerateButton } from './generate-button'
import { config } from '@/lib/log-viewer'

export default function Home() {
  const pollSeconds = Math.round(config.intervalMs / 100) / 10
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '48px 24px', lineHeight: 1.6 }}>
      <h1 style={{ marginBottom: 8 }}>next-log-viewer example</h1>
      <p style={{ color: '#555', marginTop: 0 }}>
        The button below calls a server-side API route (<code>/api/demo</code>) that emits
        several logs through <code>log.info / warn / error</code>. Those logs normally only
        appear in your terminal — here you can watch them live in a GUI instead.
      </p>

      <ol style={{ color: '#333' }}>
        <li>Click <strong>Generate server logs</strong> a few times.</li>
        <li>
          Open the <a href={config.path} target="_blank" rel="noreferrer">log viewer</a> and unlock it
          with the secret <code>dev-secret</code>.
        </li>
        <li>Click generate again and watch new entries stream in (~{pollSeconds}s poll).</li>
      </ol>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 24 }}>
        <GenerateButton />
        <a href={config.path} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
          Open the log viewer →
        </a>
      </div>
    </main>
  )
}

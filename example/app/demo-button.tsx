'use client'
import { useState } from 'react'

// A small client button that pings a server endpoint. Reused for both demos
// (explicit logging and outbound-fetch capture) so the two stay in sync.
export function DemoButton({ endpoint, idleLabel }: { endpoint: string; idleLabel: string }) {
  const [count, setCount] = useState(0)
  const [busy, setBusy] = useState(false)

  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await fetch(endpoint)
          setCount((c) => c + 1)
        } finally {
          setBusy(false)
        }
      }}
      style={{
        padding: '10px 16px',
        fontSize: 15,
        borderRadius: 8,
        border: '1px solid #333',
        background: busy ? '#eee' : '#111',
        color: busy ? '#999' : '#fff',
        cursor: busy ? 'default' : 'pointer',
      }}
    >
      {busy ? 'Running…' : `${idleLabel}${count ? ` (${count}×)` : ''}`}
    </button>
  )
}

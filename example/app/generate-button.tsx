'use client'
import { useState } from 'react'

export function GenerateButton() {
  const [count, setCount] = useState(0)
  const [busy, setBusy] = useState(false)

  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await fetch('/api/demo')
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
      {busy ? 'Generating…' : `Generate server logs${count ? ` (${count}×)` : ''}`}
    </button>
  )
}

'use client'
import { useEffect, useRef, useState } from 'react'
import type { Level, LogEntry, ViewerConfig } from '../core/types'
import { useLogStream, type StreamStatus } from './useLogStream'

export interface LogViewerProps {
  /** Client-safe config from createLogViewer(...).config. Single source of truth. */
  config: ViewerConfig
}

const LEVEL_OPTIONS: Level[] = ['debug', 'info', 'warn', 'error']

export function LogViewer({ config }: LogViewerProps) {
  const [level, setLevel] = useState<Level>('debug')
  const [search, setSearch] = useState('')
  const { entries, status, paused, setPaused, clear, authenticate } = useLogStream({
    basePath: config.basePath,
    intervalMs: config.intervalMs,
    level,
    search: search || undefined,
  })

  const listRef = useRef<HTMLUListElement>(null)
  const stickRef = useRef(true)
  // Keep newest entries in view while live, unless the user has scrolled up to read.
  useEffect(() => {
    const el = listRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [entries])

  if (status === 'unauthorized') {
    return (
      <div className="nlv-root nlv-center">
        <style>{STYLES}</style>
        <AuthForm onSubmit={authenticate} path={config.path} />
      </div>
    )
  }

  const seconds = Math.round(config.intervalMs / 100) / 10

  return (
    <div className="nlv-root" data-testid="log-viewer">
      <style>{STYLES}</style>
      <header className="nlv-bar" role="toolbar">
        <div className="nlv-bar-group">
          <span className="nlv-brand" title={config.path}>
            <span className="nlv-brand-glyph" aria-hidden>▣</span> logs
            <span className="nlv-brand-path">{config.path}</span>
          </span>
          <select
            className="nlv-select"
            aria-label="minimum level"
            value={level}
            onChange={(e) => setLevel(e.target.value as Level)}
          >
            {LEVEL_OPTIONS.map((l) => (
              <option key={l} value={l}>≥ {l}</option>
            ))}
          </select>
          <input
            className="nlv-input"
            aria-label="search"
            placeholder="filter…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="nlv-bar-group">
          <span className="nlv-interval" title="auto-refresh interval (set in config)" aria-hidden>
            ⟳ {seconds}s
          </span>
          <button className="nlv-btn" onClick={() => setPaused(!paused)}>
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button className="nlv-btn" onClick={clear}>🗑 Clear</button>
          <StatusPill status={status} count={entries.length} />
        </div>
      </header>
      <ul className="nlv-list" ref={listRef} onScroll={onScrollStick(listRef, stickRef)}>
        {entries.length === 0 ? (
          <li className="nlv-empty">
            <span className="nlv-empty-glyph" aria-hidden>›_</span>
            Waiting for logs…
          </li>
        ) : (
          entries.map((e) => <LogRow key={e.id} entry={e} />)
        )}
      </ul>
    </div>
  )
}

function onScrollStick(
  listRef: React.RefObject<HTMLUListElement>,
  stickRef: React.MutableRefObject<boolean>,
) {
  return () => {
    const el = listRef.current
    if (!el) return
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }
}

function StatusPill({ status, count }: { status: StreamStatus; count: number }) {
  const labels: Record<StreamStatus, string> = {
    connecting: 'connecting',
    live: 'live',
    paused: 'paused',
    unauthorized: 'locked',
    error: 'error',
  }
  return (
    <span className="nlv-status" data-testid="status">
      <span className="nlv-dot" data-s={status} aria-hidden />
      {labels[status]}
      <span className="nlv-count">{count}</span>
    </span>
  )
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false)
  const hasDetail = entry.data !== undefined || entry.error !== undefined
  const detail = entry.error
    ? entry.error.stack ?? `${entry.error.name}: ${entry.error.message}`
    : JSON.stringify(entry.data, null, 2)
  return (
    <li className="nlv-row" data-level={entry.level}>
      <button
        type="button"
        className="nlv-row-btn"
        disabled={!hasDetail}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <time className="nlv-time" dateTime={new Date(entry.ts).toISOString()}>
          {new Date(entry.ts).toISOString().slice(11, 23)}
        </time>
        <span className="nlv-badge">{entry.level}</span>
        <span className="nlv-msg">{entry.message}</span>
        {hasDetail && <span className="nlv-chev" aria-hidden>{open ? '▾' : '▸'}</span>}
      </button>
      {open && hasDetail && <pre className="nlv-detail">{detail}</pre>}
    </li>
  )
}

function AuthForm({ onSubmit, path }: { onSubmit: (secret: string) => Promise<boolean>; path: string }) {
  const [secret, setSecret] = useState('')
  const [error, setError] = useState(false)
  return (
    <form
      className="nlv-card"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await onSubmit(secret)
        setError(!ok)
      }}
    >
      <div className="nlv-lock" aria-hidden>🔒</div>
      <h1 className="nlv-card-title">Log viewer</h1>
      <p className="nlv-card-sub">{path} is protected. Enter the viewer secret to continue.</p>
      <input
        className="nlv-input nlv-card-input"
        aria-label="secret"
        type="password"
        value={secret}
        onChange={(e) => { setSecret(e.target.value); setError(false) }}
        placeholder="viewer secret"
        autoFocus
      />
      <button type="submit" className="nlv-btn nlv-btn-primary">Unlock</button>
      {error && <p role="alert" className="nlv-error">Invalid secret — try again.</p>}
    </form>
  )
}

const STYLES = `
.nlv-root{
  --nlv-bg:#0b0e14; --nlv-bar:#0e131b; --nlv-border:#1c2430; --nlv-row:#0d1117;
  --nlv-hover:#121a26; --nlv-text:#cdd6e3; --nlv-muted:#7b8694; --nlv-faint:#5b6675;
  --nlv-btn:#18212e; --nlv-btn-hover:#212d3d; --nlv-accent:#3fb950;
  color-scheme:dark;
  display:flex; flex-direction:column; height:100vh; box-sizing:border-box;
  background:var(--nlv-bg); color:var(--nlv-text);
  font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
  font-size:12.5px; line-height:1.5;
}
.nlv-root *{ box-sizing:border-box; }
.nlv-center{ align-items:center; justify-content:center; }

.nlv-bar{
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  flex-wrap:wrap; padding:8px 12px; background:var(--nlv-bar);
  border-bottom:1px solid var(--nlv-border); position:sticky; top:0; z-index:1;
}
.nlv-bar-group{ display:flex; align-items:center; gap:8px; }
.nlv-brand{ display:inline-flex; align-items:baseline; gap:6px; font-weight:600; letter-spacing:.02em; margin-right:4px; }
.nlv-brand-glyph{ color:var(--nlv-accent); }
.nlv-brand-path{ color:var(--nlv-faint); font-weight:400; font-size:11px; }

.nlv-select,.nlv-input{
  background:#0a0e15; color:var(--nlv-text); border:1px solid var(--nlv-border);
  border-radius:6px; padding:5px 8px; font:inherit; outline:none;
}
.nlv-select:focus,.nlv-input:focus{ border-color:#2f6feb; box-shadow:0 0 0 2px rgba(47,111,235,.25); }
.nlv-input{ width:160px; }
.nlv-input::placeholder{ color:var(--nlv-faint); }

.nlv-interval{ color:var(--nlv-muted); font-size:11px; padding:0 4px; user-select:none; }

.nlv-btn{
  background:var(--nlv-btn); color:var(--nlv-text); border:1px solid var(--nlv-border);
  border-radius:6px; padding:5px 10px; font:inherit; cursor:pointer; transition:background .12s,border-color .12s;
}
.nlv-btn:hover{ background:var(--nlv-btn-hover); border-color:#33404f; }
.nlv-btn:active{ transform:translateY(1px); }
.nlv-btn-primary{ background:#1f6feb; border-color:#1f6feb; color:#fff; font-weight:600; width:100%; justify-content:center; padding:9px; }
.nlv-btn-primary:hover{ background:#388bfd; border-color:#388bfd; }

.nlv-status{ display:inline-flex; align-items:center; gap:6px; color:var(--nlv-muted); font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
.nlv-count{ background:#10161f; border:1px solid var(--nlv-border); border-radius:10px; padding:0 7px; color:var(--nlv-muted); }
.nlv-dot{ width:8px; height:8px; border-radius:50%; background:var(--nlv-faint); }
.nlv-dot[data-s="live"]{ background:var(--nlv-accent); animation:nlv-pulse 2s infinite; }
.nlv-dot[data-s="connecting"]{ background:#e3b341; }
.nlv-dot[data-s="error"]{ background:#f85149; }
@keyframes nlv-pulse{ 0%{box-shadow:0 0 0 0 rgba(63,185,80,.5)} 70%{box-shadow:0 0 0 6px rgba(63,185,80,0)} 100%{box-shadow:0 0 0 0 rgba(63,185,80,0)} }

.nlv-list{ list-style:none; margin:0; padding:4px 0; flex:1; overflow:auto; }
.nlv-empty{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; height:100%; color:var(--nlv-faint); }
.nlv-empty-glyph{ font-size:22px; color:var(--nlv-muted); }

.nlv-row{ border-bottom:1px solid #11161e; }
.nlv-row:hover{ background:var(--nlv-hover); }
.nlv-row[data-level="error"]{ box-shadow:inset 2px 0 0 #f85149; }
.nlv-row[data-level="warn"]{ box-shadow:inset 2px 0 0 #d29922; }
.nlv-row-btn{
  display:flex; align-items:center; gap:12px; width:100%; text-align:left;
  background:none; border:0; color:inherit; font:inherit; padding:4px 12px; cursor:pointer;
}
.nlv-row-btn:disabled{ cursor:default; }
.nlv-row-btn:focus-visible{ outline:1px solid #2f6feb; outline-offset:-1px; }
.nlv-time{ color:var(--nlv-faint); flex:0 0 auto; font-variant-numeric:tabular-nums; }
.nlv-badge{
  flex:0 0 auto; min-width:46px; text-align:center; text-transform:uppercase;
  font-size:10px; font-weight:700; letter-spacing:.05em; padding:2px 6px; border-radius:5px;
}
.nlv-row[data-level="debug"] .nlv-badge{ color:#8b949e; background:rgba(139,148,158,.12); }
.nlv-row[data-level="info"]  .nlv-badge{ color:#58a6ff; background:rgba(88,166,255,.13); }
.nlv-row[data-level="warn"]  .nlv-badge{ color:#e3b341; background:rgba(227,179,65,.14); }
.nlv-row[data-level="error"] .nlv-badge{ color:#ff7b72; background:rgba(248,81,73,.15); }
.nlv-msg{ flex:1 1 auto; min-width:0; white-space:pre-wrap; word-break:break-word; }
.nlv-chev{ flex:0 0 auto; color:var(--nlv-faint); }
.nlv-detail{
  margin:0; padding:10px 12px 12px 46px; background:#080b10; color:#9aa6b6;
  border-top:1px solid var(--nlv-border); overflow-x:auto; font-size:11.5px;
}

.nlv-card{
  display:flex; flex-direction:column; gap:10px; width:320px; max-width:90vw; padding:28px 24px;
  background:var(--nlv-bar); border:1px solid var(--nlv-border); border-radius:12px;
  box-shadow:0 16px 50px rgba(0,0,0,.45); text-align:center;
}
.nlv-lock{ font-size:26px; }
.nlv-card-title{ margin:0; font-size:16px; font-weight:600; }
.nlv-card-sub{ margin:0 0 6px; color:var(--nlv-muted); font-size:11.5px; line-height:1.5; }
.nlv-card-input{ width:100%; text-align:center; letter-spacing:.15em; }
.nlv-error{ margin:2px 0 0; color:#ff7b72; font-size:11.5px; }
`

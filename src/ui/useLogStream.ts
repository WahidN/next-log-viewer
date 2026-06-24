'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { LogEntry, Level, QueryResult } from '../core/types'

export interface UseLogStreamOptions {
  basePath: string
  intervalMs?: number
  level?: Level
  search?: string
}

export type StreamStatus = 'connecting' | 'live' | 'paused' | 'unauthorized' | 'error'

export interface UseLogStream {
  entries: LogEntry[]
  status: StreamStatus
  paused: boolean
  setPaused: (p: boolean) => void
  clear: () => void
  authenticate: (secret: string) => Promise<boolean>
}

export function useLogStream(options: UseLogStreamOptions): UseLogStream {
  const { intervalMs = 5000, level, search } = options
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [status, setStatus] = useState<StreamStatus>('connecting')
  const [paused, setPaused] = useState(false)
  // We poll /entries ONLY once authenticated. This keeps an unauthed viewer from
  // hammering the API with 401s — it probes /session once, then waits for the secret.
  const [authed, setAuthed] = useState(false)
  const cursorRef = useRef<string>('')
  const optsRef = useRef(options)
  optsRef.current = options

  const poll = useCallback(async () => {
    const { basePath, level, search } = optsRef.current
    const params = new URLSearchParams()
    if (cursorRef.current) params.set('since', cursorRef.current)
    if (level) params.set('level', level)
    if (search) params.set('search', search)
    try {
      const res = await fetch(`${basePath}/entries?${params.toString()}`, { credentials: 'same-origin' })
      if (res.status === 401) { setAuthed(false); setStatus('unauthorized'); return }
      if (!res.ok) { setStatus('error'); return }
      const data: QueryResult = await res.json()
      if (data.entries.length) {
        cursorRef.current = data.cursor
        setEntries((prev) => [...prev, ...data.entries])
      }
      setStatus('live')
    } catch {
      setStatus('error')
    }
  }, [])

  // Probe the session once on mount so we know whether to poll or show the unlock
  // form. /session always responds 200, so this never produces a 401.
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const res = await fetch(`${optsRef.current.basePath}/session`, { credentials: 'same-origin' })
        if (!active) return
        if (!res.ok) { setStatus('error'); return }
        const body = (await res.json()) as { authed?: boolean }
        if (!active) return
        if (body.authed) setAuthed(true)
        else setStatus('unauthorized')
      } catch {
        if (active) setStatus('error')
      }
    })()
    return () => { active = false }
  }, [options.basePath])

  // Reset the stream when filters change so results stay consistent.
  useEffect(() => {
    cursorRef.current = ''
    setEntries([])
  }, [level, search])

  // The poll loop runs only while authenticated and not paused.
  useEffect(() => {
    if (!authed) return
    if (paused) { setStatus('paused'); return }
    let active = true
    const tick = () => { if (active) void poll() }
    tick()
    const id = setInterval(tick, intervalMs)
    return () => { active = false; clearInterval(id) }
  }, [authed, paused, intervalMs, poll, level, search])

  const authenticate = useCallback(async (secret: string) => {
    const res = await fetch(`${optsRef.current.basePath}/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ secret }),
    })
    if (res.ok) {
      cursorRef.current = ''
      setEntries([])
      setStatus('connecting')
      setAuthed(true)
      return true
    }
    return false
  }, [])

  const clear = useCallback(() => setEntries([]), [])

  return { entries, status, paused, setPaused, clear, authenticate }
}

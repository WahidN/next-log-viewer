import { log } from '@/lib/log-viewer'

// A stand-in for a real server-side API route — the kind whose console output is
// painful to read in the terminal. Every log here shows up in the GUI at /logs.
// Force dynamic so each click re-runs the handler (otherwise Next may cache it).
export const dynamic = 'force-dynamic'

export async function GET() {
  log.info('GET /api/demo called')

  const userId = Math.floor(Math.random() * 1000)
  log.debug('fetching user from db', { userId })

  await new Promise((resolve) => setTimeout(resolve, 40))

  log.info('user fetched', {
    userId,
    name: 'Ada Lovelace',
    roles: ['admin', 'user'],
    flags: { beta: true },
  })

  log.warn('cache miss', { key: `user:${userId}` })

  try {
    throw new Error('simulated downstream timeout while enriching profile')
  } catch (err) {
    log.error('failed to enrich user profile', err)
  }

  return Response.json({ ok: true, userId })
}

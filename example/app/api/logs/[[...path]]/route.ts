import { handlers } from '@/lib/log-viewer'

// Catch-all mount for the viewer. The package routes on the last path segment,
// so this single file serves both /api/logs/entries (GET) and /api/logs/auth (POST).
// Force dynamic: these read cookies/query params and must run per request.
export const dynamic = 'force-dynamic'
export const { GET, POST } = handlers

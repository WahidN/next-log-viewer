import type { ReactNode } from 'react'

export const metadata = {
  title: 'next-log-viewer example',
  description: 'Demo app for viewing Next.js server-side logs in a GUI',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>{children}</body>
    </html>
  )
}

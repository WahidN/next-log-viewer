import { LogViewer } from 'next-log-viewer/ui'
import { config } from '@/lib/log-viewer'

export default function LogsPage() {
  return <LogViewer config={config} />
}

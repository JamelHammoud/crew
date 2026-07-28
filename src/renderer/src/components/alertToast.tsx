import type { AgentAlert } from '../../../shared/alerts'
import { toast } from '../state/toast'
import AgentIcon from './AgentIcon'
import Avatar from './Avatar'

// Everything the app would have put in the corner of the screen it is said in
// the app as well, so the word arrives whether or not somebody is looking at
// another window. It carries the face it is about and the way into the work.
export function alertToast(alert: AgentAlert, open: (threadId: string) => void): void {
  const face = alert.agentId ? (
    <AgentIcon seed={alert.agentId} size="xs" />
  ) : alert.from ? (
    <Avatar name={alert.from} size="xs" />
  ) : undefined
  toast(alert.title, {
    tone: alert.stopped ? 'fail' : 'plain',
    detail: alert.body || undefined,
    mark: face,
    key: alert.threadId ? `alert:${alert.threadId}` : undefined,
    action: alert.threadId ? { label: 'Open', onPress: () => open(alert.threadId as string) } : undefined
  })
}

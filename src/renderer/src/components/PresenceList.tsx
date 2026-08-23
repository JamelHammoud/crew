import type { ReactElement } from 'react'
import type { Present } from '../../../shared/presence'
import AgentIcon from './AgentIcon'
import Avatar from './Avatar'
import { MenuDivider } from './Popover'
import type { AgentActivity } from './agentActivity'

export function Face({
  who,
  size = 'md',
  activity
}: {
  who: Present
  size?: 'sm' | 'md'
  activity?: AgentActivity
}): ReactElement {
  return who.agent ? (
    <AgentIcon seed={who.id} size={size} photo={who.photo} activity={activity} />
  ) : (
    <Avatar name={who.name} size={size} photo={who.photo} />
  )
}

// A long name is cut rather than pushing the row wider than what holds it, so
// nothing ever scrolls sideways.
function Group({
  label,
  who,
  activities
}: {
  label: string
  who: Present[]
  activities?: Record<string, AgentActivity>
}): ReactElement | null {
  if (who.length === 0) return null
  return (
    <div className="py-2">
      <p className="px-3 pb-2 text-xs font-semibold text-fg-muted">{label}</p>
      <div className="space-y-0.5">
        {who.map(one => (
          <div key={one.id} className="flex items-center gap-2.5 px-3 py-1">
            <Face who={one} size="sm" activity={activities?.[one.id]} />
            <span className="flex-1 min-w-0 text-sm font-medium text-fg truncate">{one.name}</span>
            {one.threads > 0 && (
              <span className="shrink-0 pl-4 text-xs text-fg-muted whitespace-nowrap">
                {one.threads === 1 ? '1 thread' : `${one.threads} threads`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PresenceList({
  here,
  activities
}: {
  here: Present[]
  activities?: Record<string, AgentActivity>
}): ReactElement {
  const people = here.filter(one => !one.agent)
  const working = here.filter(one => one.agent)
  return (
    <>
      <Group label="Online" who={people} activities={activities} />
      {people.length > 0 && working.length > 0 && <MenuDivider />}
      <Group label="Working" who={working} activities={activities} />
    </>
  )
}

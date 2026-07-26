import type { ReactElement } from 'react'
import type { Present } from '../../../shared/presence'
import AgentIcon from './AgentIcon'
import Avatar from './Avatar'
import { MenuDivider } from './Popover'

export function Face({ who, size = 'md' }: { who: Present; size?: 'sm' | 'md' }): ReactElement {
  return who.agent ? (
    <AgentIcon seed={who.id} size={size} photo={who.photo} />
  ) : (
    <Avatar name={who.name} size={size} />
  )
}

// A long name is cut rather than pushing the row wider than what holds it, so
// nothing ever scrolls sideways.
function Group({ label, who }: { label: string; who: Present[] }): ReactElement | null {
  if (who.length === 0) return null
  return (
    <div className="py-2">
      <p className="px-3 pb-2 text-xs font-semibold text-fg-muted">{label}</p>
      <div className="space-y-0.5">
        {who.map(one => (
          <div key={one.id} className="flex items-center gap-2.5 px-3 py-1">
            <Face who={one} size="sm" />
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

export default function PresenceList({ here }: { here: Present[] }): ReactElement {
  const people = here.filter(one => !one.agent)
  const working = here.filter(one => one.agent)
  return (
    <>
      <Group label="Online" who={people} />
      {people.length > 0 && working.length > 0 && <MenuDivider />}
      <Group label="Working" who={working} />
    </>
  )
}

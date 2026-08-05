import type { ReactNode } from 'react'
import Tooltip from './Tooltip'

// One button for the state you are not in. A panel that is up is put away from
// its own top corner, so nothing stands here until there is a panel to ask back,
// and it wears what is behind it rather than a mark for a panel.
export default function DesignPanelBack({
  label,
  onOpen,
  children
}: {
  label: string
  onOpen: () => void
  children: ReactNode
}) {
  return (
    <Tooltip label={label}>
      <button
        onClick={onOpen}
        aria-label={label}
        className="glass glass-strong w-12 h-12 rounded-full flex items-center justify-center text-fg/70 transition-all duration-150 hover:text-fg active:scale-95 pointer-events-auto"
      >
        {children}
      </button>
    </Tooltip>
  )
}

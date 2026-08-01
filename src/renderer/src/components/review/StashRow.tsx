import { useState } from 'react'
import type { RepoStash } from '../../../../shared/repository'
import { MoreGlyph, TrashGlyph, UnarchiveGlyph } from '../../icons'
import { MenuDivider, MenuItem, Popover } from '../Popover'
import Tooltip from '../Tooltip'

export default function StashRow({
  stash,
  onApply,
  onDrop
}: {
  stash: RepoStash
  onApply: () => void
  onDrop: () => void
}) {
  const [menu, setMenu] = useState(false)

  return (
    <div className="flex h-10 items-center gap-2 rounded-card bg-ink-800 pl-3.5 pr-1.5">
      <span className="min-w-0 flex-1 truncate text-sm text-fg-secondary">{stash.message}</span>
      {stash.branch && <span className="max-w-28 shrink-0 truncate text-xs text-fg-faint">{stash.branch}</span>}
      <div className="relative shrink-0">
        <Tooltip label="More" disabled={menu}>
          <button
            aria-label={`More for ${stash.message}`}
            onClick={() => setMenu(true)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg active:scale-90"
          >
            <MoreGlyph className="w-4 h-4" />
          </button>
        </Tooltip>
        <Popover open={menu} onClose={() => setMenu(false)} align="end">
          <MenuItem
            icon={<UnarchiveGlyph className="w-4 h-4" />}
            label="Apply stash"
            onClick={() => {
              setMenu(false)
              onApply()
            }}
          />
          <MenuDivider />
          <MenuItem
            icon={<TrashGlyph className="w-4 h-4" />}
            label="Drop stash"
            danger
            onClick={() => {
              setMenu(false)
              onDrop()
            }}
          />
        </Popover>
      </div>
    </div>
  )
}

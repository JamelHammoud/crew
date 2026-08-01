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

  // The name starts where a file's name starts, past the column the status
  // letter stands in, so the two kinds of row read as one list.
  return (
    <div className="group flex h-7 items-center gap-2 rounded-xl pl-7 pr-1 transition-colors hover:bg-fg/[0.04]">
      <span className="min-w-0 flex-1 truncate text-[13px] text-fg-secondary">{stash.message}</span>
      {stash.branch && <span className="max-w-24 shrink-0 truncate text-xs text-fg-faint">{stash.branch}</span>}
      <div className="relative shrink-0">
        <Tooltip label="More" disabled={menu}>
          <button
            aria-label={`More for ${stash.message}`}
            onClick={() => setMenu(true)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-fg-muted opacity-0 transition-colors hover:bg-fg/10 hover:text-fg active:scale-90 group-hover:opacity-100 focus-within:opacity-100"
          >
            <MoreGlyph className="w-3.5 h-3.5" />
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

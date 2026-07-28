import { GhostGlyph } from '../icons'

export default function GhostBar() {
  return (
    <div className="bg-ink-800 text-fg rounded-t-[30px] flex items-center justify-center gap-1.5 pt-2 pb-12 -mb-10 text-sm font-semibold">
      <GhostGlyph className="w-4 h-4" />
      Ghost mode
    </div>
  )
}
